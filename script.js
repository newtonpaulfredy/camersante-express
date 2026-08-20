document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "/api"; // Remplace par ton URL Render une fois en ligne

    // ÉLÉMENTS DOM
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const authOverlay = document.getElementById('authOverlay');
    const appContainer = document.getElementById('appContainer');

    // MODAUX
    const btnUrgence = document.getElementById('btnUrgence');
    const btnCloseUrgence = document.getElementById('btnCloseUrgence');
    const urgenceModal = document.getElementById('urgenceModal');

    const btnAdmin = document.getElementById('btnAdmin');
    const btnCloseAdmin = document.getElementById('btnCloseAdmin');
    const adminModal = document.getElementById('adminModal');
    const addPharmacyForm = document.getElementById('addPharmacyForm');
    const adminPharmacyTable = document.getElementById('adminPharmacyTable');

    // FILTRES
    const filterCity = document.getElementById('filterCity');
    const searchQuery = document.getElementById('searchQuery');
    const filterGardeOnly = document.getElementById('filterGardeOnly');
    const btnGeolocate = document.getElementById('btnGeolocate');

    // DONNÉES
    let rawPharmacies = [];
    let map = null;
    let markersLayer = null;
    let userMarker = null;
    let markersMap = {};
    let userCoords = null;

    const cityCoordinates = {
        'Yaoundé': [3.8480, 11.5021],
        'Douala': [4.0511, 9.7679],
        'Bafoussam': [5.4778, 10.4176],
        'Garoua': [9.3012, 13.3977]
    };

    // --- GESTION URGENCES & ADMIN ---
    if (btnUrgence && urgenceModal) btnUrgence.addEventListener('click', () => urgenceModal.classList.remove('hidden'));
    if (btnCloseUrgence && urgenceModal) btnCloseUrgence.addEventListener('click', () => urgenceModal.classList.add('hidden'));

    if (btnAdmin && adminModal) {
        btnAdmin.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            renderAdminTable();
        });
    }
    if (btnCloseAdmin && adminModal) btnCloseAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));

    // --- AUTHENTIFICATION ---
    if (tabLogin && tabSignup) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        });

        tabSignup.addEventListener('click', () => {
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                let response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (response.status === 422) {
                    const formData = new URLSearchParams();
                    formData.append('username', email);
                    formData.append('password', password);

                    response = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData
                    });
                }

                const data = await response.json();
                if (!response.ok) return alert(data.detail || "Identifiants incorrects.");

                const token = data.access_token || data.token;
                const user = data.user || { full_name: email.split('@')[0] };

                sessionStorage.setItem('cs_token', token);
                sessionStorage.setItem('cs_user', JSON.stringify(user));
                grantAccess(user.full_name || 'Utilisateur');

            } catch (err) {
                alert("Erreur de connexion au serveur.");
            }
        });
    }

    function grantAccess(name) {
        const userDisplay = document.getElementById('userNameDisplay');
        if (userDisplay) userDisplay.textContent = name;
        if (authOverlay) authOverlay.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');

        setTimeout(() => {
            initMap();
            fetchPharmacies();
        }, 250);
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            location.reload();
        });
    }

    const savedUser = JSON.parse(sessionStorage.getItem('cs_user'));
    if (savedUser) grantAccess(savedUser.full_name || savedUser.name);

    // CARTE LEAFLET
    function initMap() {
        if (!map) {
            map = L.map('map').setView([3.8480, 11.5021], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
            markersLayer = L.layerGroup().addTo(map);
        }
        setTimeout(() => map.invalidateSize(), 300);
    }

    // CHARGEMENT PHARMACIES
    async function fetchPharmacies() {
        try {
            const res = await fetch(`${API_URL}/pharmacies`);
            if (!res.ok) throw new Error();
            rawPharmacies = await res.json();

            // Injecter des stocks de démonstration si le backend ne renvoie pas encore de liste de médicaments
            rawPharmacies = rawPharmacies.map(p => ({
                ...p,
                medicaments: p.medicaments || ["Paracétamol", "Ibuprofène", "Amoxicilline", "Vitamine C", "Artemether", "Spasfon"]
            }));

            applyFilters();
        } catch (e) {
            console.error("Erreur serveur.");
        }
    }

    // GÉOLOCALISATION
    if (btnGeolocate) {
        btnGeolocate.addEventListener('click', () => {
            if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
            btnGeolocate.textContent = "⌛ Localisation...";

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userCoords = [pos.coords.latitude, pos.coords.longitude];
                    btnGeolocate.textContent = "📍 Position trouvée !";
                    setTimeout(() => { btnGeolocate.textContent = "📍 Me géolocaliser"; }, 3000);

                    if (map) {
                        map.setView(userCoords, 14, { animate: true });
                        if (userMarker) map.removeLayer(userMarker);
                        userMarker = L.circleMarker(userCoords, { color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.8, radius: 10 }).addTo(map);
                        userMarker.bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
                    }
                    applyFilters();
                },
                () => {
                    btnGeolocate.textContent = "📍 Me géolocaliser";
                    alert("Erreur de géolocalisation.");
                }
            );
        });
    }

    // --- FILTRAGE INTELLIGENT (NOM, QUARTIER & MÉDICAMENTS) ---
    function applyFilters() {
        const selectedCity = filterCity ? filterCity.value : 'Toutes';
        const query = searchQuery ? searchQuery.value.trim().toLowerCase() : '';
        const gardeOnly = filterGardeOnly ? filterGardeOnly.checked : false;

        const filtered = rawPharmacies.filter(p => {
            const matchCity = (selectedCity === 'Toutes') || (p.ville && p.ville.toLowerCase() === selectedCity.toLowerCase());

            // Recherche multi-critères (Nom, Quartier OU Médicament disponible)
            const matchName = p.nom && p.nom.toLowerCase().includes(query);
            const matchQuartier = p.quartier && p.quartier.toLowerCase().includes(query);

            let matchMeds = false;
            if (Array.isArray(p.medicaments)) {
                matchMeds = p.medicaments.some(m => m.toLowerCase().includes(query));
            } else if (typeof p.medicaments === 'string') {
                matchMeds = p.medicaments.toLowerCase().includes(query);
            }

            const matchQuery = !query || matchName || matchQuartier || matchMeds;
            const matchGarde = !gardeOnly || p.est_de_garde;

            return matchCity && matchQuery && matchGarde;
        });

        if (selectedCity !== 'Toutes' && cityCoordinates[selectedCity] && map && !userCoords) {
            map.setView(cityCoordinates[selectedCity], 13);
        }
        renderFilteredResults(filtered, query);
    }

    // --- AFFICHAGE DES RÉSULTATS AVEC AFFICHE DU STOCK ---
    function renderFilteredResults(pharmacies, querySearch) {
        const listElem = document.getElementById('pharmacyList');
        const countElem = document.getElementById('resultCount');

        if (countElem) countElem.textContent = `${pharmacies.length} trouvée(s)`;
        if (listElem) listElem.innerHTML = '';
        if (markersLayer) markersLayer.clearLayers();
        markersMap = {};

        if (pharmacies.length === 0) {
            if (listElem) listElem.innerHTML = '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:15px;">Aucune pharmacie trouvée avec ces critères.</p>';
            return;
        }

        pharmacies.forEach((p, index) => {
            const pId = p.id || index;
            const mapsUrl = userCoords ?
                `https://www.google.com/maps/dir/?api=1&origin=${userCoords[0]},${userCoords[1]}&destination=${p.latitude},${p.longitude}` :
                `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;

            // Formatage des médicaments en puces
            const medsArray = Array.isArray(p.medicaments) ? p.medicaments : (p.medicaments ? p.medicaments.split(',') : []);
            const medsBadges = medsArray.map(m => {
                const isMatch = querySearch && m.toLowerCase().includes(querySearch);
                return `<span style="display:inline-block; font-size:10px; padding:2px 6px; border-radius:4px; margin:2px; background:${isMatch ? '#059669' : '#334155'}; color:white;">💊 ${m.trim()}</span>`;
            }).slice(0, 4).join('');

            // 1. Marqueur carte
            if (p.latitude && p.longitude && markersLayer) {
                const marker = L.marker([p.latitude, p.longitude]);
                marker.bindPopup(`
          <div style="font-family: sans-serif;">
            <b style="color: #0ea5e9;">${p.nom}</b><br>
            📍 ${p.quartier || p.ville}<br>
            📞 ${p.telephone || 'N/A'}<br>
            <b>${p.est_de_garde ? '🟢 DE GARDE' : '🔴 FERMÉ'}</b><br><br>
            <div style="margin-bottom:8px;">${medsBadges}</div>
            <a href="${mapsUrl}" target="_blank" style="padding:4px 8px; background:#059669; color:white; border-radius:4px; font-size:11px; text-decoration:none;">🚗 Y aller</a>
          </div>
        `);
                markersLayer.addLayer(marker);
                markersMap[pId] = marker;
            }

            // 2. Carte dans la liste
            if (listElem) {
                const card = document.createElement('div');
                card.className = 'pharmacy-card';
                card.innerHTML = `
          <span class="status-badge ${p.est_de_garde ? 'garde' : 'ferme'}">${p.est_de_garde ? 'DE GARDE' : 'FERMÉ'}</span>
          <h4>${p.nom}</h4>
          <p>📍 ${p.quartier ? p.quartier + ', ' : ''}${p.ville}</p>
          <p>📞 ${p.telephone || 'Non renseigné'}</p>
          <div style="margin-top: 6px;">${medsBadges}</div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="btn-primary btn-zoom" style="padding: 4px 8px; font-size: 11px; margin: 0; flex: 1;">🔍 Voir carte</button>
            <a href="${mapsUrl}" target="_blank" class="btn-primary" style="padding: 4px 8px; font-size: 11px; margin: 0; background: #059669; text-decoration: none; text-align: center; flex: 1;">🚗 Itinéraire</a>
          </div>
        `;

                const zoomBtn = card.querySelector('.btn-zoom');
                if (zoomBtn) {
                    zoomBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (p.latitude && p.longitude && map) {
                            map.setView([p.latitude, p.longitude], 16, { animate: true });
                            if (markersMap[pId]) markersMap[pId].openPopup();
                        }
                    });
                }
                listElem.appendChild(card);
            }
        });
    }

    // ÉCOUTEURS D'ÉVÉNEMENTS
    if (filterCity) filterCity.addEventListener('change', applyFilters);
    if (searchQuery) searchQuery.addEventListener('input', applyFilters);
    if (filterGardeOnly) filterGardeOnly.addEventListener('change', applyFilters);
});