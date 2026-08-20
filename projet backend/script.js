function showLogin() {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('signupForm').classList.add('hidden');
}

function showSignup() {
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('signupForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "/api";

    // ÉLÉMENTS DOM AUTHENTIFICATION
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const authOverlay = document.getElementById('authOverlay');
    const appContainer = document.getElementById('appContainer');
    //gestion du changement d'onglet

    // ÉLÉMENTS DOM MODAUX
    const btnUrgence = document.getElementById('btnUrgence');
    const btnCloseUrgence = document.getElementById('btnCloseUrgence');
    const urgenceModal = document.getElementById('urgenceModal');

    const btnAdmin = document.getElementById('btnAdmin');
    const btnCloseAdmin = document.getElementById('btnCloseAdmin');
    const adminModal = document.getElementById('adminModal');
    const addPharmacyForm = document.getElementById('addPharmacyForm');
    const adminPharmacyTable = document.getElementById('adminPharmacyTable');

    // FILTRES & RECHERCHE
    const filterCity = document.getElementById('filterCity');
    const searchQuery = document.getElementById('searchQuery');
    const filterGardeOnly = document.getElementById('filterGardeOnly');
    const btnGeolocate = document.getElementById('btnGeolocate');

    // DONNÉES & CARTE LEAFLET
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

    // --- 1. EFFET TYPEWRITER DYNAMIQUE ---
    const typewriterText = document.getElementById('typewriterText');
    if (typewriterText) {
        const words = ["Paracétamol ?", "Soins d'urgence ?", "Pharmacie de garde ?", "Garde à Bastos ?"];
        let wordIndex = 0;
        let charIndex = 0;
        let isDeleting = false;

        function type() {
            const currentWord = words[wordIndex];
            if (isDeleting) {
                typewriterText.textContent = currentWord.substring(0, charIndex - 1);
                charIndex--;
            } else {
                typewriterText.textContent = currentWord.substring(0, charIndex + 1);
                charIndex++;
            }

            let typeSpeed = isDeleting ? 50 : 100;

            if (!isDeleting && charIndex === currentWord.length) {
                typeSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        }
        type();
    }

    // --- 2. BASCULE ENTRE ONGLETS AUTHENTIFICATION ---
    if (tabLogin && tabSignup && loginForm && signupForm) {
        tabLogin.addEventListener('click', (e) => {
            e.preventDefault();
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        });

        tabSignup.addEventListener('click', (e) => {
            e.preventDefault();
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }

    // --- 3. SOUMISSION INSCRIPTION (AVEC FALLBACK DÉMO) ---
    if (signupForm) {
        signupForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName') ? .value.trim() || 'Utilisateur';
            const email = document.getElementById('email') ? .value.trim() || '';
            const phone = document.getElementById('phone') ? .value.trim() || '';
            const city = document.getElementById('citySelect') ? .value || '';
            const password = document.getElementById('password') ? .value || '';

            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_name: fullName, email, phone, city, password })
                });

                if (response.ok) {
                    alert("Compte créé avec succès ! Accès à l'application...");
                    const userObj = { full_name: fullName, email, city };
                    sessionStorage.setItem('cs_user', JSON.stringify(userObj));
                    grantAccess(fullName);
                } else {
                    throw new Error("Erreur de réponse serveur");
                }
            } catch (err) {
                console.warn("API indisponible, bascule en mode démo local.");
                alert(`Bienvenue ${fullName} ! (Compte créé en mode local)`);
                const userObj = { full_name: fullName, email, city };
                sessionStorage.setItem('cs_user', JSON.stringify(userObj));
                grantAccess(fullName);
            }
        });
    }

    // --- 4. SOUMISSION CONNEXION (AVEC FALLBACK DÉMO) ---
    if (loginForm) {
        loginForm.addEventListener('submit', async(e) => {
            e.preventDefault();

            const loginEmailElement = document.getElementById('loginEmail');
            const email = loginEmailElement ? loginEmailElement.value.trim() :
                '';
            const loginpasswordElement = document.getElementById('loginPassword');
            const password = loginpasswordElement ? loginpasswordElement.value : '';

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

                if (!response.ok) throw new Error("Échec de connexion serveur");

                const data = await response.json();
                const user = data.user || { full_name: email ? email.split('@')[0] : 'Utilisateur' };

                sessionStorage.setItem('cs_token', data.access_token || data.token || 'demo_token');
                sessionStorage.setItem('cs_user', JSON.stringify(user));
                grantAccess(user.full_name);

            } catch (err) {
                console.warn("API indisponible, connexion en mode démo local.");
                const userName = email ? email.split('@')[0] : "Utilisateur";
                sessionStorage.setItem('cs_user', JSON.stringify({ full_name: userName }));
                grantAccess(userName);
            }
        });
    }

    // --- ACCÈS À L'APPLICATION ---
    function grantAccess(name) {
        const userDisplay = document.getElementById('userNameDisplay');
        if (userDisplay) userDisplay.textContent = `Bienvenue, ${name}`;
        if (authOverlay) authOverlay.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');

        setTimeout(() => {
            initMap();
            fetchPharmacies();
        }, 250);
    }

    // DÉCONNEXION
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            location.reload();
        });
    }

    // RESTAURATION SESSION EXISTANTE
    const savedUser = JSON.parse(sessionStorage.getItem('cs_user'));
    if (savedUser) grantAccess(savedUser.full_name || savedUser.name);

    // --- 5. INITIALISATION DE LA CARTE LEAFLET ---
    function initMap() {
        if (!map) {
            map = L.map('map').setView([3.8480, 11.5021], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);
            markersLayer = L.layerGroup().addTo(map);
        }
        setTimeout(() => map.invalidateSize(), 300);
    }

    // --- 6. CHARGEMENT DES PHARMACIES ---
    async function fetchPharmacies() {
        try {
            const res = await fetch(`${API_URL}/pharmacies`);
            if (!res.ok) throw new Error("Erreur serveur");
            rawPharmacies = await res.json();

            rawPharmacies = rawPharmacies.map(p => ({
                ...p,
                medicaments: p.medicaments || ["Paracétamol", "Ibuprofène", "Amoxicilline", "Vitamine C"]
            }));

            applyFilters();
        } catch (e) {
            console.warn("Données chargées depuis la liste locale de secours.");
            rawPharmacies = [
                { id: 1, nom: "Pharmacie du Centre", ville: "Yaoundé", quartier: "Bastos", telephone: "699001122", latitude: 3.8700, longitude: 11.5180, est_de_garde: true, medicaments: ["Paracétamol", "Ibuprofène", "Spasfon"] },
                { id: 2, nom: "Pharmacie Akwa", ville: "Douala", quartier: "Akwa", telephone: "677003344", latitude: 4.0500, longitude: 9.7000, est_de_garde: true, medicaments: ["Amoxicilline", "Vitamine C", "Efferalgan"] },
                { id: 3, nom: "Pharmacie Marché", ville: "Bafoussam", quartier: "Marché A", telephone: "695112233", latitude: 5.4778, longitude: 10.4176, est_de_garde: false, medicaments: ["Paracétamol", "Artemether"] }
            ];
            applyFilters();
        }
    }

    // --- 7. GÉOLOCALISATION UTILISATEUR ---
    if (btnGeolocate) {
        btnGeolocate.addEventListener('click', () => {
            if (!navigator.geolocation) return alert("La géolocalisation n'est pas supportée par votre navigateur.");
            btnGeolocate.textContent = "⌛ Localisation en cours...";

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userCoords = [pos.coords.latitude, pos.coords.longitude];
                    btnGeolocate.textContent = "📍 Position trouvée !";
                    setTimeout(() => { btnGeolocate.textContent = "📍 Me géolocaliser"; }, 3000);

                    if (map) {
                        map.setView(userCoords, 14, { animate: true });
                        if (userMarker) map.removeLayer(userMarker);
                        userMarker = L.circleMarker(userCoords, {
                            color: '#0284c7',
                            fillColor: '#38bdf8',
                            fillOpacity: 0.8,
                            radius: 10
                        }).addTo(map);
                        userMarker.bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
                    }
                    applyFilters();
                },
                () => {
                    btnGeolocate.textContent = "📍 Me géolocaliser";
                    alert("Impossible d'obtenir votre position.");
                }
            );
        });
    }

    // --- 8. FILTRAGE INTELLIGENT ---
    function applyFilters() {
        const selectedCity = filterCity ? filterCity.value : 'Toutes';
        const query = searchQuery ? searchQuery.value.trim().toLowerCase() : '';
        const gardeOnly = filterGardeOnly ? filterGardeOnly.checked : false;

        const filtered = rawPharmacies.filter(p => {
            const matchCity = (selectedCity === 'Toutes') || (p.ville && p.ville.toLowerCase() === selectedCity.toLowerCase());
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

    // --- 9. RENDER DANS LA SIDEBAR ET SUR LA CARTE ---
    function renderFilteredResults(pharmacies, querySearch) {
        const listElem = document.getElementById('pharmacyList');
        const countElem = document.getElementById('resultCount');

        if (countElem) countElem.textContent = `${pharmacies.length} trouvée(s)`;
        if (listElem) listElem.innerHTML = '';
        if (markersLayer) markersLayer.clearLayers();
        markersMap = {};

        if (pharmacies.length === 0) {
            if (listElem) listElem.innerHTML = '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:15px;">Aucune pharmacie ne correspond à votre recherche.</p>';
            return;
        }

        pharmacies.forEach((p, index) => {
            const pId = p.id || index;
            const mapsUrl = userCoords ?
                `https://www.google.com/maps/dir/?api=1&origin=${userCoords[0]},${userCoords[1]}&destination=${p.latitude},${p.longitude}` :
                `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;

            const medsArray = Array.isArray(p.medicaments) ? p.medicaments : (p.medicaments ? p.medicaments.split(',') : []);
            const medsBadges = medsArray.slice(0, 4).map(m => {
                const isMatch = querySearch && m.toLowerCase().includes(querySearch);
                return `<span style="font-size:10px; padding:2px 6px; border-radius:4px; margin:2px; background:${isMatch ? '#059669' : '#334155'}; color:white; display:inline-block;">💊 ${m.trim()}</span>`;
            }).join('');

            if (p.latitude && p.longitude && markersLayer) {
                const marker = L.marker([p.latitude, p.longitude]);
                marker.bindPopup(`
                    <div style="font-family: sans-serif; color: #0f172a;">
                        <b style="color: #0ea5e9;">${p.nom}</b><br>
                        📍 ${p.quartier || p.ville}<br>
                        📞 ${p.telephone || 'Non renseigné'}<br>
                        <b>${p.est_de_garde ? '🟢 DE GARDE' : '🔴 FERMÉ'}</b><br><br>
                        <div style="margin-bottom:8px;">${medsBadges}</div>
                        <a href="${mapsUrl}" target="_blank" style="padding:4px 8px; background:#059669; color:white; border-radius:4px; font-size:11px; text-decoration:none; display:inline-block;">🚗 Y aller</a>
                    </div>
                `);
                markersLayer.addLayer(marker);
                markersMap[pId] = marker;
            }

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

    // --- 10. DÉCLENCHEURS ET MODAUX ---
    if (btnUrgence && urgenceModal) btnUrgence.addEventListener('click', () => urgenceModal.classList.remove('hidden'));
    if (btnCloseUrgence && urgenceModal) btnCloseUrgence.addEventListener('click', () => urgenceModal.classList.add('hidden'));

    if (btnAdmin && adminModal) {
        btnAdmin.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            renderAdminTable();
        });
    }
    if (btnCloseAdmin && adminModal) btnCloseAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));

    // --- 11. PANNEAU D'ADMINISTRATION ---
    function renderAdminTable() {
        if (!adminPharmacyTable) return;
        adminPharmacyTable.innerHTML = '';

        rawPharmacies.forEach((p, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 8px;"><strong>${p.nom}</strong></td>
                <td style="padding: 8px;">${p.ville} (${p.quartier || '-'})</td>
                <td style="padding: 8px;">${p.telephone || '-'}</td>
                <td style="padding: 8px;">${p.est_de_garde ? '🟢 Garde' : '🔴 Fermé'}</td>
                <td style="padding: 8px; text-align: center;">
                    <button class="btn-danger-del" style="background: #ef4444; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Supprimer</button>
                </td>
            `;

            tr.querySelector('.btn-danger-del').addEventListener('click', () => {
                if (confirm(`Supprimer la pharmacie ${p.nom} ?`)) {
                    rawPharmacies.splice(idx, 1);
                    applyFilters();
                    renderAdminTable();
                }
            });

            adminPharmacyTable.appendChild(tr);
        });
    }

    if (addPharmacyForm) {
        addPharmacyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newPharm = {
                id: Date.now(),
                nom: document.getElementById('adminNom').value,
                ville: document.getElementById('adminVille').value,
                quartier: document.getElementById('adminQuartier').value,
                telephone: document.getElementById('adminTel').value,
                latitude: parseFloat(document.getElementById('adminLat').value),
                longitude: parseFloat(document.getElementById('adminLng').value),
                est_de_garde: document.getElementById('adminGarde').checked,
                medicaments: ["Paracétamol", "Ibuprofène"]
            };

            rawPharmacies.unshift(newPharm);
            applyFilters();
            renderAdminTable();
            addPharmacyForm.reset();
            alert("Pharmacie ajoutée avec succès !");
        });
    }

    // ÉCOUTEURS D'ÉVÉNEMENTS
    if (filterCity) filterCity.addEventListener('change', applyFilters);
    if (searchQuery) searchQuery.addEventListener('input', applyFilters);
    if (filterGardeOnly) filterGardeOnly.addEventListener('change', applyFilters);
});