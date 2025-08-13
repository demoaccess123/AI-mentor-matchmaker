// Direct LinkedIn Profile Fetcher
const fetch = require('node-fetch');

// Direct LinkedIn scraping configurations
const SCRAPING_APIS = {
    scrapingbee: {
        base: 'https://app.scrapingbee.com/api/v1/',
        params: {
            render_js: 'true',
            premium_proxy: 'true',
            country_code: 'us'
        }
    },
    rapidapi_fresh: {
        host: 'fresh-linkedin-profile-data.p.rapidapi.com',
        endpoint: '/get-linkedin-profile'
    },
    rapidapi_bulk: {
        host: 'linkedin-bulk-data-scraper.p.rapidapi.com', 
        endpoint: '/profile'
    },
    serpapi: {
        base: 'https://serpapi.com/search.json'
    }
};

// Main function to fetch LinkedIn profiles directly
async function fetchDirectLinkedInProfiles(filters) {
    const allProfiles = [];
    
    // Try multiple methods in parallel
    const fetchPromises = [
        searchLinkedInViaSerpApi(filters),
        scrapeLinkedInSearch(filters), 
        fetchViaRapidAPIBulk(filters),
        fetchViaRapidAPIFresh(filters)
    ];
    
    const results = await Promise.allSettled(fetchPromises);
    
    // Combine successful results
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            allProfiles.push(...result.value);
        }
    });
    
    return removeDuplicateProfiles(allProfiles);
}

// Method 1: Find LinkedIn profiles via Google (SerpApi)
async function searchLinkedInViaSerpApi(filters) {
    if (!process.env.SERPAPI_KEY) return null;
    
    try {
        // Build LinkedIn-specific Google search query
        let query = 'site:linkedin.com/in';
        if (filters.role) query += ` "${filters.role}"`;
        if (filters.industry) query += ` "${filters.industry}"`;
        if (filters.company) query += ` "${filters.company}"`;
        if (filters.country) query += ` "${filters.country}"`;
        if (filters.college) query += ` "${filters.college}"`;
        
        const searchParams = new URLSearchParams({
            q: query,
            api_key: process.env.SERPAPI_KEY,
            engine: 'google',
            num: 20,
            start: 0
        });
        
        const response = await fetch(`${SCRAPING_APIS.serpapi.base}?${searchParams}`);
        const data = await response.json();
        
        if (data.organic_results && data.organic_results.length > 0) {
            // For each LinkedIn URL found, scrape the actual profile
            const profilePromises = data.organic_results
                .filter(result => result.link.includes('linkedin.com/in/'))
                .slice(0, 10) // Limit to avoid quota exhaustion
                .map(result => scrapeIndividualProfile(result.link, result.title));
                
            const profiles = await Promise.allSettled(profilePromises);
            
            return profiles
                .filter(p => p.status === 'fulfilled' && p.value)
                .map(p => ({ ...p.value, source: 'SerpApi + Scraping' }));
        }
        
        return null;
    } catch (error) {
        console.error('SerpApi LinkedIn search failed:', error);
        return null;
    }
}

// Method 2: Direct LinkedIn search page scraping
async function scrapeLinkedInSearch(filters) {
    if (!process.env.SCRAPINGBEE_KEY) return null;
    
    try {
        // Build LinkedIn search URL
        const linkedinSearchUrl = buildLinkedInSearchURL(filters);
        
        const params = new URLSearchParams({
            api_key: process.env.SCRAPINGBEE_KEY,
            url: linkedinSearchUrl,
            ...SCRAPING_APIS.scrapingbee.params
        });
        
        const response = await fetch(`${SCRAPING_APIS.scrapingbee.base}?${params}`);
        const html = await response.text();
        
        // Parse LinkedIn search results
        return parseLinkedInSearchHTML(html);
        
    } catch (error) {
        console.error('LinkedIn search scraping failed:', error);
        return null;
    }
}

// Method 3: RapidAPI Bulk LinkedIn Scraper
async function fetchViaRapidAPIBulk(filters) {
    if (!process.env.RAPIDAPI_KEY) return null;
    
    try {
        const searchQuery = buildSearchQuery(filters);
        
        const response = await fetch(`https://${SCRAPING_APIS.rapidapi_bulk.host}/people_search`, {
            method: 'POST',
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': SCRAPING_APIS.rapidapi_bulk.host,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                search_terms: searchQuery,
                location: filters.country || 'United States',
                count: 20
            })
        });
        
        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            return data.profiles.map(profile => normalizeRapidAPIProfile(profile, 'RapidAPI Bulk'));
        }
        
        return null;
    } catch (error) {
        console.error('RapidAPI Bulk failed:', error);
        return null;
    }
}

// Method 4: RapidAPI Fresh LinkedIn Profile Data
async function fetchViaRapidAPIFresh(filters) {
    if (!process.env.RAPIDAPI_KEY) return null;
    
    try {
        const params = new URLSearchParams();
        if (filters.role) params.append('title', filters.role);
        if (filters.industry) params.append('industry', filters.industry);
        if (filters.country) params.append('location', filters.country);
        params.append('limit', '15');
        
        const response = await fetch(`https://${SCRAPING_APIS.rapidapi_fresh.host}${SCRAPING_APIS.rapidapi_fresh.endpoint}?${params}`, {
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': SCRAPING_APIS.rapidapi_fresh.host
            }
        });
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results.map(profile => normalizeRapidAPIProfile(profile, 'RapidAPI Fresh'));
        }
        
        return null;
    } catch (error) {
        console.error('RapidAPI Fresh failed:', error);
        return null;
    }
}

// Helper function to scrape individual LinkedIn profile
async function scrapeIndividualProfile(profileUrl, fallbackName = '') {
    if (!process.env.SCRAPINGBEE_KEY) return null;
    
    try {
        const params = new URLSearchParams({
            api_key: process.env.SCRAPINGBEE_KEY,
            url: profileUrl,
            ...SCRAPING_APIS.scrapingbee.params
        });
        
        const response = await fetch(`${SCRAPING_APIS.scrapingbee.base}?${params}`);
        const html = await response.text();
        
        return parseIndividualLinkedInProfile(html, profileUrl, fallbackName);
        
    } catch (error) {
        console.error('Individual profile scraping failed:', error);
        return null;
    }
}

// HTML parsing functions
function parseIndividualLinkedInProfile(html, profileUrl, fallbackName) {
    try {
        const profile = {
            id: extractLinkedInId(profileUrl),
            linkedinUrl: profileUrl,
            source: 'Direct Scraping'
        };
        
        // Extract name
        const nameMatch = html.match(/<h1[^>]*class="[^"]*text-heading-xlarge[^"]*"[^>]*>([^<]+)</i) ||
                         html.match(/<title>([^<]+)\s*\|\s*LinkedIn</i);
        profile.name = nameMatch ? nameMatch[1].trim() : fallbackName;
        
        // Extract headline/title
        const headlineMatch = html.match(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([^<]+)</i);
        profile.headline = headlineMatch ? headlineMatch[1].trim() : '';
        
        // Extract location
        const locationMatch = html.match(/<span[^>]*class="[^"]*text-body-small[^"]*"[^>]*>([^<]*,\s*[^<]+)</i);
        profile.location = locationMatch ? locationMatch[1].trim() : '';
        
        // Extract company from headline
        const companyMatch = profile.headline.match(/at\s+([^,\|\n]+)/i);
        profile.company = companyMatch ? companyMatch[1].trim() : '';
        
        // Extract skills from page content
        const skillsSection = html.match(/<section[^>]*id="skills"[^>]*>.*?<\/section>/is);
        if (skillsSection) {
            const skillMatches = skillsSection.match(/<span[^>]*class="[^"]*skill-name[^"]*"[^>]*>([^<]+)</g);
            profile.skills = skillMatches ? 
                skillMatches.map(match => match.replace(/<[^>]+>/g, '').trim()).slice(0, 8) : [];
        } else {
            profile.skills = extractSkillsFromContent(html);
        }
        
        // Extract summary/about
        const aboutMatch = html.match(/<section[^>]*aria-labelledby="about"[^>]*>.*?<div[^>]*class="[^"]*display-flex[^"]*"[^>]*>([^<]+)</is);
        profile.summary = aboutMatch ? aboutMatch[1].trim().substring(0, 200) + '...' : '';
        
        return profile;
        
    } catch (error) {
        console.error('Profile parsing failed:', error);
        return {
            id: extractLinkedInId(profileUrl),
            name: fallbackName,
            linkedinUrl: profileUrl,
            source: 'Partial Scraping'
        };
    }
}

function parseLinkedInSearchHTML(html) {
    const profiles = [];
    
    try {
        // LinkedIn search results pattern
        const profileBlocks = html.match(/<div[^>]*class="[^"]*entity-result__item[^"]*"[^>]*>.*?<\/div>/gs) || [];
        
        profileBlocks.slice(0, 10).forEach((block, index) => {
            const profile = { source: 'LinkedIn Search' };
            
            // Extract profile URL
            const linkMatch = block.match(/href="([^"]*\/in\/[^"]*)/);
            profile.linkedinUrl = linkMatch ? linkMatch[1].split('?') : '#';
            profile.id = extractLinkedInId(profile.linkedinUrl);
            
            // Extract name
            const nameMatch = block.match(/<span[^>]*aria-hidden="true"[^>]*>([^<]+)/);
            profile.name = nameMatch ? nameMatch[1].trim() : `Profile ${index + 1}`;
            
            // Extract headline
            const headlineMatch = block.match(/<div[^>]*class="[^"]*entity-result__primary-subtitle[^"]*"[^>]*>([^<]+)/);
            profile.headline = headlineMatch ? headlineMatch[1].trim() : '';
            
            // Extract location
            const locationMatch = block.match(/<div[^>]*class="[^"]*entity-result__secondary-subtitle[^"]*"[^>]*>([^<]+)/);
            profile.location = locationMatch ? locationMatch[1].trim() : '';
            
            profiles.push(profile);
        });
        
    } catch (error) {
        console.error('Search HTML parsing failed:', error);
    }
    
    return profiles;
}

// Helper functions
function buildLinkedInSearchURL(filters) {
    let url = 'https://www.linkedin.com/search/results/people/?keywords=';
    
    const keywords = [];
    if (filters.role) keywords.push(filters.role);
    if (filters.industry) keywords.push(filters.industry);
    
    url += encodeURIComponent(keywords.join(' '));
    
    if (filters.country) {
        // LinkedIn uses geographic URNs, but we'll use keywords for simplicity
        url += `&geoUrn=["${encodeURIComponent(filters.country)}"]`;
    }
    
    return url;
}

function buildSearchQuery(filters) {
    const terms = [];
    if (filters.role) terms.push(filters.role);
    if (filters.industry) terms.push(filters.industry);
    if (filters.company) terms.push(filters.company);
    return terms.join(' ');
}

function normalizeRapidAPIProfile(profile, source) {
    return {
        id: profile.linkedin_id || profile.public_identifier || profile.id,
        name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline || profile.title || profile.current_position_title,
        company: profile.current_company || profile.company_name,
        location: profile.location || profile.geo_location,
        industry: profile.industry,
        skills: profile.skills || profile.skill_names || [],
        summary: profile.summary || profile.description || '',
        linkedinUrl: profile.linkedin_url || profile.profile_url || `https://linkedin.com/in/${profile.public_identifier}`,
        source: source
    };
}

function extractLinkedInId(url) {
    const match = url.match(/linkedin\.com\/in\/([^\/\?\#]+)/);
    return match ? match[1] : `profile_${Date.now()}`;
}

function extractSkillsFromContent(html) {
    const commonSkills = [
        'JavaScript', 'Python', 'React', 'Node.js', 'Product Management', 
        'Marketing', 'Sales', 'Leadership', 'Strategy', 'Analytics',
        'Machine Learning', 'Data Science', 'Cloud Computing', 'AWS',
        'Project Management', 'Business Development', 'Consulting'
    ];
    
    return commonSkills.filter(skill => 
        html.toLowerCase().includes(skill.toLowerCase())
    ).slice(0, 6);
}

function removeDuplicateProfiles(profiles) {
    const seen = new Set();
    return profiles.filter(profile => {
        const key = profile.name?.toLowerCase() + profile.linkedinUrl;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Enhanced demo data with more realistic LinkedIn-style profiles
function getRealisticDemoProfiles(filters) {
    const demoProfiles = [
        {
            id: 'sarah-chen-pm',
            name: 'Sarah Chen',
            headline: 'Senior Product Manager at Google | Ex-Meta | Stanford MBA',
            company: 'Google',
            location: 'San Francisco Bay Area',
            industry: 'Technology',
            skills: ['Product Strategy', 'Data Analytics', 'User Research', 'A/B Testing', 'SQL', 'Figma'],
            summary: 'Leading product initiatives for Google Cloud Platform. Previously built consumer products at Meta reaching 100M+ users. Passionate about AI/ML applications in productivity tools.',
            linkedinUrl: 'https://linkedin.com/in/sarah-chen-pm',
            source: 'Demo'
        },
        {
            id: 'michael-rodriguez-swe',
            name: 'Michael Rodriguez',
            headline: 'Staff Software Engineer at Netflix | Distributed Systems Expert',
            company: 'Netflix',
            location: 'Los Gatos, California',
            industry: 'Technology',
            skills: ['Java', 'Python', 'Kubernetes', 'Microservices', 'System Design', 'AWS'],
            summary: 'Building scalable streaming infrastructure serving 200M+ subscribers globally. Open source contributor to Apache Kafka. Mentor to 50+ junior engineers.',
            linkedinUrl: 'https://linkedin.com/in/michael-rodriguez-swe',
            source: 'Demo'
        },
        {
            id: 'emily-wang-marketing',
            name: 'Emily Wang',
            headline: 'VP of Marketing at Stripe | Growth & Brand Strategy Leader',
            company: 'Stripe',
            location: 'New York, New York',
            industry: 'Marketing',
            skills: ['Growth Marketing', 'Brand Strategy', 'Performance Marketing', 'Analytics', 'SQL', 'Looker'],
            summary: 'Scaled Stripe\'s marketing from $100M to $1B+ ARR. Expert in B2B SaaS growth, brand positioning, and data-driven marketing. Former consultant at McKinsey.',
            linkedinUrl: 'https://linkedin.com/in/emily-wang-marketing',
            source: 'Demo'
        },
        {
            id: 'james-kim-founder',
            name: 'James Kim',
            headline: 'Co-Founder & CEO at TechStart (YC W20) | 2x Exit | Angel Investor',
            company: 'TechStart',
            location: 'Austin, Texas',
            industry: 'Technology',
            skills: ['Entrepreneurship', 'Fundraising', 'Product Development', 'Team Building', 'Strategic Planning', 'Venture Capital'],
            summary: 'Serial entrepreneur with 2 successful exits ($50M+ total). Angel investor in 30+ startups. Raised $25M+ across multiple ventures. Y Combinator alum.',
            linkedinUrl: 'https://linkedin.com/in/james-kim-founder',
            source: 'Demo'
        },
        {
            id: 'lisa-thompson-consulting',
            name: 'Lisa Thompson',
            headline: 'Principal at McKinsey & Company | Healthcare & Digital Transformation',
            company: 'McKinsey & Company',
            location: 'Chicago, Illinois',
            industry: 'Consulting',
            skills: ['Strategy Consulting', 'Digital Transformation', 'Healthcare', 'Change Management', 'Data Analytics', 'Leadership'],
            summary: 'Leading digital transformation initiatives for Fortune 500 healthcare companies. 12+ years at McKinsey serving C-suite executives. Harvard Business School MBA.',
            linkedinUrl: 'https://linkedin.com/in/lisa-thompson-consulting',
            source: 'Demo'
        },
        {
            id: 'david-patel-finance',
            name: 'David Patel',
            headline: 'VP, Investment Banking at Goldman Sachs | Tech M&A Specialist',
            company: 'Goldman Sachs',
            location: 'New York, New York', 
            industry: 'Finance',
            skills: ['Investment Banking', 'M&A', 'Financial Modeling', 'Valuation', 'Due Diligence', 'Client Management'],
            summary: 'Leading M&A transactions for tech companies ($100M - $10B+). Advised on 50+ deals including IPOs and strategic acquisitions. Wharton MBA, CFA charterholder.',
            linkedinUrl: 'https://linkedin.com/in/david-patel-finance',
            source: 'Demo'
        }
    ];

    // Smart filtering
    return demoProfiles.filter(profile => {
        let matches = true;
        
        if (filters.industry) {
            matches = matches && profile.industry.toLowerCase().includes(filters.industry.toLowerCase());
        }
        
        if (filters.role) {
            matches = matches && (
                profile.headline.toLowerCase().includes(filters.role.toLowerCase()) ||
                profile.skills.some(skill => skill.toLowerCase().includes(filters.role.toLowerCase()))
            );
        }
        
        if (filters.country) {
            const countryMappings = {
                'United States': ['California', 'New York', 'Texas', 'Illinois'],
                'US': ['California', 'New York', 'Texas', 'Illinois'],
                'USA': ['California', 'New York', 'Texas', 'Illinois']
            };
            
            const locations = countryMappings[filters.country] || [filters.country];
            matches = matches && locations.some(loc => profile.location.includes(loc));
        }
        
        if (filters.company) {
            matches = matches && profile.company.toLowerCase().includes(filters.company.toLowerCase());
        }
        
        return matches;
    });
}

// Main export function
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const filters = req.body;
        
        // Fetch real LinkedIn profiles
        let profiles = await fetchDirectLinkedInProfiles(filters);
        let provider = 'Direct LinkedIn APIs';
        let quotaUsed = [];
        
        // Add quota tracking
        if (process.env.SERPAPI_KEY) quotaUsed.push('SerpApi: 100/month');
        if (process.env.SCRAPINGBEE_KEY) quotaUsed.push('ScrapingBee: 1000/month');
        if (process.env.RAPIDAPI_KEY) quotaUsed.push('RapidAPI: 50/month');
        
        // Fallback to realistic demo data
        if (!profiles || profiles.length === 0) {
            profiles = getRealisticDemoProfiles(filters);
            provider = 'Enhanced Demo LinkedIn Profiles';
        }
        
        // Ensure we have some results
        if (profiles.length === 0) {
            profiles = getRealisticDemoProfiles({}); // Get all demo profiles
        }
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(200).json({
            profiles: profiles.slice(0, 25), // Limit results
            provider: provider,
            total: profiles.length,
            quotaInfo: quotaUsed,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('LinkedIn profile fetch error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Always return demo data as final fallback
        const profiles = getRealisticDemoProfiles(req.body || {});
        
        return res.status(200).json({
            profiles: profiles,
            provider: 'Demo Data (API Error)',
            total: profiles.length,
            error: 'APIs temporarily unavailable',
            timestamp: new Date().toISOString()
        });
    }
}
