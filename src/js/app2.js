// Navigation Functions - ADD THIS AT THE TOP
function showHome() {
    document.getElementById('home').style.display = 'block';
    document.getElementById('search').style.display = 'none';
    updateNavigation('home');
}

function showSearch() {
    document.getElementById('home').style.display = 'none';
    document.getElementById('search').style.display = 'block';
    updateNavigation('search');
}

function updateNavigation(active) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`a[href="#${active}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Rest of your existing app2.js code continues below...


// Direct LinkedIn Profile Fetcher Frontend
let currentProfiles = [];
let isSearching = false;

// Enhanced search functionality for LinkedIn profiles
async function searchLinkedInProfiles() {
    if (isSearching) return;
    
    const industry = document.getElementById('industry').value;
    const role = document.getElementById('role').value; 
    const country = document.getElementById('country').value;
    const company = document.getElementById('company').value;
    const college = document.getElementById('college').value;

    // Enhanced validation
    if (!industry && !role && !country && !company) {
        showError('Please fill at least one search field to find LinkedIn profiles');
        return;
    }

    // Show loading state
    setLoadingState(true);

    try {
        const filters = { industry, role, country, company, college };
        
        const response = await fetch('/api/fetchLinkedInProfiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(filters)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            currentProfiles = data.profiles;
            displayLinkedInProfiles(data.profiles, data.provider, data.quotaInfo);
            showSuccess(`Found ${data.profiles.length} LinkedIn profiles via ${data.provider}`);
        } else {
            showError('No LinkedIn profiles found. Try different search criteria or check back later.');
        }

    } catch (error) {
        console.error('LinkedIn search error:', error);
        showError('Search failed. Using demo profiles for now.');
        
        // Show demo data on error
        const demoProfiles = getDemoProfiles();
        displayLinkedInProfiles(demoProfiles, 'Demo Profiles', []);
        
    } finally {
        setLoadingState(false);
    }
}

function displayLinkedInProfiles(profiles, provider, quotaInfo) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <div class="results-header">
            <h3>LinkedIn Profiles Found (${profiles.length} results)</h3>
            <div class="provider-info">
                <span class="provider-badge">📊 Source: ${provider}</span>
                ${quotaInfo && quotaInfo.length > 0 ? `
                    <div class="quota-info">
                        <small>API Quotas: ${quotaInfo.join(', ')}</small>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    profiles.forEach(profile => {
        const initials = profile.name ? 
            profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : 
            '??';
            
        const skills = profile.skills || [];
        const isRealProfile = profile.linkedinUrl && profile.linkedinUrl !== '#';
        
        html += `
            <div class="linkedin-profile-card" data-source="${profile.source}">
                <div class="profile-header">
                    <div class="profile-avatar ${isRealProfile ? 'real-profile' : 'demo-profile'}">
                        ${initials}
                        ${isRealProfile ? '<div class="verified-badge">✓</div>' : ''}
                    </div>
                    <div class="profile-info">
                        <h3 class="profile-name">${profile.name || 'Name not available'}</h3>
                        <p class="profile-headline">${profile.headline || 'Professional'}</p>
                        <div class="profile-details">
                            ${profile.company ? `<span class="detail-item">🏢 ${profile.company}</span>` : ''}
                            ${profile.location ? `<span class="detail-item">📍 ${profile.location}</span>` : ''}
                            ${profile.industry ? `<span class="detail-item">🏭 ${profile.industry}</span>` : ''}
                        </div>
                    </div>
                    <div class="profile-source">
                        <span class="source-badge">${profile.source}</span>
                    </div>
                </div>
                
                ${profile.summary ? `
                    <div class="profile-summary">
                        <p>${profile.summary}</p>
                    </div>
                ` : ''}
                
                ${skills.length > 0 ? `
                    <div class="profile-skills">
                        <h4>Skills & Expertise</h4>
                        <div class="skills-container">
                            ${skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="profile-actions">
                    ${isRealProfile ? `
                        <a href="${profile.linkedinUrl}" target="_blank" class="linkedin-button">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230077b5'%3E%3Cpath d='M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'/%3E%3C/svg%3E" width="20" height="20" alt="LinkedIn"> 
                            View LinkedIn Profile
                        </a>
                    ` : `
                        <button class="demo-button" onclick="showDemoAlert()">
                            📝 Demo Profile
                        </button>
                    `}
                    
                    <button class="contact-button" onclick="showContactModal('${profile.name}', '${profile.linkedinUrl}')">
                        💬 Connect
                    </button>
                    
                    <button class="bookmark-button" onclick="bookmarkProfile('${profile.id}')">
                        🔖 Save
                    </button>
                </div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
    
    // Add some analytics
    trackSearch(profiles.length, provider);
}

function setLoadingState(loading) {
    isSearching = loading;
    const searchButton = document.querySelector('.search-button');
    const searchText = document.getElementById('search-text');
    const loadingIndicator = document.getElementById('loading');
    
    if (loading) {
        searchText.style.display = 'none';
        loadingIndicator.style.display = 'inline';
        loadingIndicator.textContent = '🔍 Fetching LinkedIn profiles...';
        searchButton.disabled = true;
    } else {
        searchText.style.display = 'inline';
        loadingIndicator.style.display = 'none';
        searchButton.disabled = false;
    }
}

function showContactModal(name, profileUrl) {
    const modal = document.createElement('div');
    modal.className = 'contact-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Connect with ${name}</h3>
                <button onclick="this.closest('.contact-modal').remove()" class="close-button">×</button>
            </div>
            <div class="modal-body">
                <p>Ways to connect with this mentor:</p>
                <ul>
                    ${profileUrl !== '#' ? `<li><a href="${profileUrl}" target="_blank">Send LinkedIn connection request</a></li>` : ''}
                    <li><a href="mailto:?subject=Mentorship Request&body=Hi ${name}, I found your profile through MentorMatch AI and would love to connect...">Send email introduction</a></li>
                    <li>Save their profile and reach out through mutual connections</li>
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function bookmarkProfile(profileId) {
    let bookmarks = JSON.parse(localStorage.getItem('bookmarkedProfiles') || '[]');
    const profile = currentProfiles.find(p => p.id === profileId);
    
    if (profile && !bookmarks.find(b => b.id === profileId)) {
        bookmarks.push(profile);
        localStorage.setItem('bookmarkedProfiles', JSON.stringify(bookmarks));
        showSuccess(`Bookmarked ${profile.name}'s profile!`);
    }
}

function showDemoAlert() {
    alert('This is a demo profile. Sign up for our premium service to access real LinkedIn profiles with contact information!');
}

function trackSearch(resultsCount, provider) {
    // Simple analytics tracking
    const searches = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    searches.push({
        timestamp: new Date().toISOString(),
        resultsCount,
        provider
    });
    localStorage.setItem('searchHistory', JSON.stringify(searches.slice(-50))); // Keep last 50 searches
}

function getDemoProfiles() {
    return [
        {
            id: 'demo-sarah-chen',
            name: 'Sarah Chen',
            headline: 'Senior Product Manager at Google | Ex-Meta | Stanford MBA',
            company: 'Google',
            location: 'San Francisco Bay Area',
            industry: 'Technology',
            skills: ['Product Strategy', 'Data Analytics', 'User Research', 'A/B Testing'],
            summary: 'Leading product initiatives for Google Cloud Platform...',
            linkedinUrl: '#',
            source: 'Demo'
        }
        // Add more demo profiles as needed
    ];
}

// Enhanced error handling
function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>Search Issue</h3>
            <p>${message}</p>
            <button onclick="searchLinkedInProfiles()" class="retry-button">Try Again</button>
        </div>
    `;
}

function showSuccess(message) {
    const resultsDiv = document.getElementById('results');
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `✅ ${message}`;
    resultsDiv.insertBefore(successDiv, resultsDiv.firstChild);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 5000);
}

// Initialize enhanced functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add company field to search form
    addCompanyField();
    
    // Enhanced keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            searchLinkedInProfiles();
        }
    });
    
    // Auto-save search preferences
    saveSearchPreferences();
});

function addCompanyField() {
    const roleField = document.getElementById('role').closest('.form-group');
    const companyGroup = document.createElement('div');
    companyGroup.className = 'form-group';
    companyGroup.innerHTML = `
        <label>Company (Optional)</label>
        <input type="text" id="company" placeholder="e.g., Google, Meta, Netflix">
    `;
    roleField.insertAdjacentElement('afterend', companyGroup);
}

function saveSearchPreferences() {
    const fields = ['industry', 'role', 'country', 'company', '
