// Complete working app2.js with navigation
let currentProfiles = [];
let isSearching = false;

// Navigation Functions
function showHome() {
    const homeSection = document.getElementById('home');
    const searchSection = document.getElementById('search');
    
    if (homeSection) homeSection.style.display = 'block';
    if (searchSection) searchSection.style.display = 'none';
    updateNavigation('home');
}

function showSearch() {
    const homeSection = document.getElementById('home');
    const searchSection = document.getElementById('search');
    
    if (homeSection) homeSection.style.display = 'none';
    if (searchSection) searchSection.style.display = 'block';
    updateNavigation('search');
    
    // Add company field if it doesn't exist
    addCompanyFieldIfNeeded();
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

// Add company field dynamically
function addCompanyFieldIfNeeded() {
    if (!document.getElementById('company')) {
        const roleField = document.getElementById('role');
        if (roleField) {
            const roleGroup = roleField.closest('.form-group');
            const companyGroup = document.createElement('div');
            companyGroup.className = 'form-group';
            companyGroup.innerHTML = `
                <label>Company (Optional)</label>
                <input type="text" id="company" placeholder="e.g., Google, Meta, Netflix">
            `;
            roleGroup.insertAdjacentElement('afterend', companyGroup);
        }
    }
}

// Search functionality
async function searchLinkedInProfiles() {
    if (isSearching) return;
    
    const industry = document.getElementById('industry')?.value || '';
    const role = document.getElementById('role')?.value || '';
    const country = document.getElementById('country')?.value || '';
    const company = document.getElementById('company')?.value || '';
    const college = document.getElementById('college')?.value || '';

    if (!industry && !role && !country && !company) {
        showError('Please fill at least one search field to find LinkedIn profiles');
        return;
    }

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

        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            currentProfiles = data.profiles;
            displayLinkedInProfiles(data.profiles, data.provider);
            showSuccess(`Found ${data.profiles.length} LinkedIn profiles via ${data.provider}`);
        } else {
            showError('No LinkedIn profiles found. Try different search criteria.');
        }

    } catch (error) {
        console.error('Search error:', error);
        
        // Show demo data on error
        const demoProfiles = getDemoProfiles();
        displayLinkedInProfiles(demoProfiles, 'Demo Profiles (API Error)');
        showSuccess('Showing demo profiles - API temporarily unavailable');
        
    } finally {
        setLoadingState(false);
    }
}

function displayLinkedInProfiles(profiles, provider) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;
    
    let html = `
        <div class="results-header">
            <h3>LinkedIn Profiles Found (${profiles.length} results)</h3>
            <div class="provider-info">
                <span class="provider-badge">📊 Source: ${provider}</span>
            </div>
        </div>
    `;
    
    profiles.forEach(profile => {
        const initials = profile.name ? 
            profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
        const skills = profile.skills || [];
        
        html += `
            <div class="linkedin-profile-card">
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${initials}
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
                    ${profile.linkedinUrl && profile.linkedinUrl !== '#' ? `
                        <a href="${profile.linkedinUrl}" target="_blank" class="linkedin-button">
                            🔗 View LinkedIn Profile
                        </a>
                    ` : `
                        <button class="demo-button">📝 Demo Profile</button>
                    `}
                    <button class="contact-button">💬 Connect</button>
                    <button class="bookmark-button">🔖 Save</button>
                </div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
}

function setLoadingState(loading) {
    isSearching = loading;
    const searchButton = document.querySelector('.search-button');
    const searchText = document.getElementById('search-text');
    const loadingIndicator = document.getElementById('loading');
    
    if (searchButton) searchButton.disabled = loading;
    if (searchText) searchText.style.display = loading ? 'none' : 'inline';
    if (loadingIndicator) {
        loadingIndicator.style.display = loading ? 'inline' : 'none';
        loadingIndicator.textContent = '🔍 Searching LinkedIn profiles...';
    }
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="error">❌ ${message}</div>`;
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.innerHTML = `✅ ${message}`;
        resultsDiv.insertBefore(successDiv, resultsDiv.firstChild);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 5000);
    }
}

function getDemoProfiles() {
    return [
        {
            id: 'demo-sarah',
            name: 'Sarah Chen',
            headline: 'Senior Product Manager at Google | Ex-Meta | Stanford MBA',
            company: 'Google',
            location: 'San Francisco Bay Area',
            industry: 'Technology',
            skills: ['Product Strategy', 'Data Analytics', 'User Research', 'A/B Testing'],
            summary: 'Leading product initiatives for Google Cloud Platform. Passionate about AI/ML applications.',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-michael',
            name: 'Michael Rodriguez',
            headline: 'Staff Software Engineer at Netflix | Distributed Systems Expert',
            company: 'Netflix',
            location: 'Los Gatos, California',
            industry: 'Technology',
            skills: ['Java', 'Python', 'Kubernetes', 'System Design'],
            summary: 'Building scalable streaming infrastructure serving 200M+ subscribers globally.',
            linkedinUrl: '#',
            source: 'Demo'
        }
    ];
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Navigation event listeners
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            if (target === 'home') showHome();
            else if (target === 'search') showSearch();
        });
    });
    
    // Make functions available globally
    window.showHome = showHome;
    window.showSearch = showSearch;
    window.searchLinkedInProfiles = searchLinkedInProfiles;
});
