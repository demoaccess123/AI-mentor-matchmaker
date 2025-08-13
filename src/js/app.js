// Global state
let currentMentors = [];

// Navigation
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
    document.querySelector(`a[href="#${active}"]`).classList.add('active');
}

// Search functionality
async function searchMentors() {
    const industry = document.getElementById('industry').value;
    const role = document.getElementById('role').value;
    const country = document.getElementById('country').value;
    const college = document.getElementById('college').value;

    // Validation
    if (!industry && !role && !country) {
        showError('Please fill at least one search field');
        return;
    }

    // Show loading state
    document.getElementById('search-text').style.display = 'none';
    document.getElementById('loading').style.display = 'inline';
    document.querySelector('.search-button').disabled = true;

    try {
        const filters = { industry, role, country, college };
        const response = await fetch('/api/searchMentors', {
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
        
        if (data.mentors && data.mentors.length > 0) {
            currentMentors = data.mentors;
            displayMentors(data.mentors, data.provider);
            showSuccess(`Found ${data.mentors.length} mentors using ${data.provider}`);
        } else {
            showError('No mentors found. Try adjusting your search criteria.');
        }

    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed. Please try again later.');
    } finally {
        // Reset loading state
        document.getElementById('search-text').style.display = 'inline';
        document.getElementById('loading').style.display = 'none';
        document.querySelector('.search-button').disabled = false;
    }
}

function displayMentors(mentors, provider) {
    const resultsDiv = document.getElementById('results');
    
    let html = `<h3>Search Results (${mentors.length} mentors found via ${provider})</h3>`;
    
    mentors.forEach(mentor => {
        const initials = mentor.name ? mentor.name.split(' ').map(n => n[0]).join('') : '??';
        const skills = mentor.skills || [];
        
        html += `
            <div class="mentor-card">
                <div class="mentor-header">
                    <div class="mentor-avatar">${initials}</div>
                    <div class="mentor-info">
                        <h3>${mentor.name || 'Name not available'}</h3>
                        <p>${mentor.headline || mentor.title || 'Professional'}</p>
                        <p>📍 ${mentor.location || 'Location not specified'}</p>
                        ${mentor.company ? `<p>🏢 ${mentor.company}</p>` : ''}
                    </div>
                </div>
                
                ${mentor.summary ? `<p class="mentor-summary">${mentor.summary}</p>` : ''}
                
                ${skills.length > 0 ? `
                    <div class="mentor-skills">
                        ${skills.slice(0, 5).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        ${skills.length > 5 ? `<span class="skill-tag">+${skills.length - 5} more</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="mentor-actions" style="margin-top: 1rem;">
                    ${mentor.linkedinUrl ? `<a href="${mentor.linkedinUrl}" target="_blank" style="color: #0077b5;">View LinkedIn Profile</a>` : ''}
                </div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="error">❌ ${message}</div>`;
}

function showSuccess(message) {
    const resultsDiv = document.getElementById('results');
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.innerHTML = `✅ ${message}`;
    resultsDiv.insertBefore(successDiv, resultsDiv.firstChild);
    
    // Remove success message after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 5000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            if (target === 'home') showHome();
            else if (target === 'search') showSearch();
        });
    });

    // Enter key in search fields
    document.querySelectorAll('#search input, #search select').forEach(field => {
        field.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchMentors();
            }
        });
    });
});
