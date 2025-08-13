// Enhanced API with multiple data sources
const fetch = require('node-fetch');

// API Configurations
const APIs = {
    rapidapi: {
        host: 'linkedin-data-api.p.rapidapi.com',
        endpoint: '/people-search'
    },
    apollo: {
        base: 'https://api.apollo.io/v1/people/search'
    },
    serpapi: {
        base: 'https://serpapi.com/search.json'
    },
    scrapingbee: {
        base: 'https://app.scrapingbee.com/api/v1/'
    }
};

// Enhanced search with multiple APIs
async function searchMultipleAPIs(filters) {
    const results = [];
    
    // Try each API in order of quota generosity
    const apiResults = await Promise.allSettled([
        searchSerpApi(filters),      // 100 free calls
        searchScrapingBee(filters),  // 1000 free calls  
        searchRapidAPI(filters),     // 50 free calls
        searchApollo(filters),       // 5 free calls
    ]);

    // Combine all successful results
    apiResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            results.push(...result.value);
        }
    });

    return results;
}

// SerpApi - Search LinkedIn profiles via Google
async function searchSerpApi(filters) {
    if (!process.env.SERPAPI_KEY) return null;
    
    try {
        let query = 'site:linkedin.com/in';
        if (filters.role) query += ` "${filters.role}"`;
        if (filters.industry) query += ` "${filters.industry}"`;
        if (filters.country) query += ` "${filters.country}"`;
        
        const url = `${APIs.serpapi.base}?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=20`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.organic_results) {
            return data.organic_results.map(result => ({
                id: extractLinkedInId(result.link),
                name: extractNameFromTitle(result.title),
                headline: result.snippet || '',
                linkedinUrl: result.link,
                industry: filters.industry,
                location: filters.country,
                skills: extractSkillsFromSnippet(result.snippet),
                source: 'SerpApi'
            }));
        }
        
        return null;
    } catch (error) {
        console.error('SerpApi failed:', error);
        return null;
    }
}

// ScrapingBee - Scrape LinkedIn search results
async function searchScrapingBee(filters) {
    if (!process.env.SCRAPINGBEE_KEY) return null;
    
    try {
        const searchUrl = buildLinkedInSearchUrl(filters);
        const url = `${APIs.scrapingbee.base}?api_key=${process.env.SCRAPINGBEE_KEY}&url=${encodeURIComponent(searchUrl)}&render_js=true`;
        
        const response = await fetch(url);
        const html = await response.text();
        
        // Parse LinkedIn search results HTML
        return parseLinkedInSearchResults(html);
        
    } catch (error) {
        console.error('ScrapingBee failed:', error);
        return null;
    }
}



// Enhanced RapidAPI search
async function searchRapidAPI(filters) {
    if (!process.env.RAPIDAPI_KEY) return null;
    
    try {
        const params = new URLSearchParams();
        if (filters.role) params.append('keywords', filters.role);
        if (filters.country) params.append('location', filters.country);
        params.append('start', '0');
        params.append('count', '25');
        
        const response = await fetch(`https://linkedin-bulk-data-scraper.p.rapidapi.com/people_search?${params}`, {
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'linkedin-bulk-data-scraper.p.rapidapi.com'
            }
        });
        
        const data = await response.json();
        
        if (data.data && data.data.elements) {
            return data.data.elements.map(person => ({
                id: person.urn_id,
                name: `${person.first_name} ${person.last_name}`,
                headline: person.headline,
                company: person.current_positions?.[0]?.company_name,
                location: person.location,
                industry: person.industry_name,
                skills: person.skills || [],
                linkedinUrl: `https://linkedin.com/in/${person.public_identifier}`,
                source: 'RapidAPI'
            }));
        }
        
        return null;
    } catch (error) {
        console.error('RapidAPI failed:', error);
        return null;
    }
}

// Helper functions
function buildLinkedInSearchUrl(filters) {
    let url = 'https://www.linkedin.com/search/results/people/?keywords=';
    if (filters.role) url += encodeURIComponent(filters.role);
    if (filters.industry) url += `&industry=${encodeURIComponent(filters.industry)}`;
    if (filters.country) url += `&geoUrn=${encodeURIComponent(filters.country)}`;
    return url;
}

function parseLinkedInSearchResults(html) {
    // Simple HTML parsing for LinkedIn search results
    const profiles = [];
    const nameRegex = /<span[^>]*aria-hidden="true"[^>]*>([^<]+)</g;
    const titleRegex = /<div[^>]*class="[^"]*entity-result__primary-subtitle[^"]*"[^>]*>([^<]+)/g;
    
    let match;
    const names = [];
    const titles = [];
    
    while ((match = nameRegex.exec(html)) !== null) {
        names.push(match[1].trim());
    }
    
    while ((match = titleRegex.exec(html)) !== null) {
        titles.push(match[1].trim());
    }
    
    for (let i = 0; i < Math.min(names.length, titles.length, 10); i++) {
        profiles.push({
            id: `scraped_${i}`,
            name: names[i],
            headline: titles[i],
            source: 'ScrapingBee',
            linkedinUrl: '#'
        });
    }
    
    return profiles;
}

function extractLinkedInId(url) {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : url;
}

function extractNameFromTitle(title) {
    return title.split(' | ') || title.split(' - ') || title;
}

function extractSkillsFromSnippet(snippet) {
    const skillKeywords = ['JavaScript', 'Python', 'React', 'Node.js', 'Product Management', 'Marketing', 'Sales', 'Leadership', 'Strategy'];
    return skillKeywords.filter(skill => 
        snippet && snippet.toLowerCase().includes(skill.toLowerCase())
    ).slice(0, 5);
}

// Comprehensive fallback demo data
function getEnhancedDemoData(filters) {
    const demoMentors = [
        {
            id: 'demo-1',
            name: 'Sarah Chen',
            headline: 'Senior Product Manager at Google',
            company: 'Google',
            location: 'San Francisco, CA',
            industry: 'Technology',
            skills: ['Product Strategy', 'Data Analysis', 'Team Leadership', 'User Research', 'Agile'],
            summary: 'Leading product initiatives for Google Cloud Platform with 8+ years experience',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-2',
            name: 'Michael Rodriguez',
            headline: 'Software Engineering Manager at Microsoft',
            company: 'Microsoft',
            location: 'Seattle, WA',
            industry: 'Technology',
            skills: ['Software Architecture', 'Team Management', 'Cloud Computing', '.NET', 'Azure'],
            summary: 'Building scalable systems and leading engineering teams at Microsoft Azure',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-3',
            name: 'Emily Johnson',
            headline: 'Marketing Director at Salesforce',
            company: 'Salesforce',
            location: 'New York, NY',
            industry: 'Marketing',
            skills: ['Digital Marketing', 'Brand Strategy', 'Content Marketing', 'Analytics', 'CRM'],
            summary: 'Driving growth through innovative marketing strategies in B2B SaaS',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-4',
            name: 'David Kim',
            headline: 'Investment Banking VP at Goldman Sachs',
            company: 'Goldman Sachs',
            location: 'New York, NY',
            industry: 'Finance',
            skills: ['Financial Modeling', 'M&A', 'Investment Strategy', 'Risk Management', 'Client Relations'],
            summary: 'Specializing in tech sector M&A transactions and growth financing',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-5',
            name: 'Lisa Wang',
            headline: 'UX Design Lead at Meta',
            company: 'Meta',
            location: 'Menlo Park, CA',
            industry: 'Technology',
            skills: ['User Experience', 'Design Systems', 'Prototyping', 'User Research', 'Product Design'],
            summary: 'Creating intuitive experiences for billions of users across Facebook products',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-6',
            name: 'James Thompson',
            headline: 'Data Science Director at Netflix',
            company: 'Netflix',
            location: 'Los Gatos, CA',
            industry: 'Technology',
            skills: ['Machine Learning', 'Data Science', 'Python', 'Statistics', 'A/B Testing'],
            summary: 'Leading personalization algorithms that power content recommendations',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-7',
            name: 'Rachel Green',
            headline: 'Consulting Partner at McKinsey & Company',
            company: 'McKinsey & Company',
            location: 'Chicago, IL',
            industry: 'Consulting',
            skills: ['Strategy Consulting', 'Business Transformation', 'Leadership', 'Change Management', 'Operations'],
            summary: 'Helping Fortune 500 companies navigate digital transformation',
            linkedinUrl: '#',
            source: 'Demo'
        },
        {
            id: 'demo-8',
            name: 'Alex Patel',
            headline: 'Startup Founder & CEO',
            company: 'TechStart Inc',
            location: 'Austin, TX',
            industry: 'Technology',
            skills: ['Entrepreneurship', 'Fundraising', 'Product Development', 'Team Building', 'Strategy'],
            summary: 'Serial entrepreneur, raised $50M+, 2 successful exits in fintech and healthtech',
            linkedinUrl: '#',
            source: 'Demo'
        }
    ];

    // Smart filtering based on search criteria
    return demoMentors.filter(mentor => {
        let matches = true;
        
        if (filters.industry) {
            matches = matches && mentor.industry.toLowerCase().includes(filters.industry.toLowerCase());
        }
        
        if (filters.role) {
            matches = matches && (
                mentor.headline.toLowerCase().includes(filters.role.toLowerCase()) ||
                mentor.skills.some(skill => skill.toLowerCase().includes(filters.role.toLowerCase()))
            );
        }
        
        if (filters.country) {
            matches = matches && mentor.location.includes(filters.country);
        }
        
        return matches;
    });
}

// Main export function for Vercel
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
        
        // Try to get real data from APIs
        let mentors = await searchMultipleAPIs(filters);
        let provider = 'Multiple APIs';
        
        // If no real data, use enhanced demo data
        if (!mentors || mentors.length === 0) {
            mentors = getEnhancedDemoData(filters);
            provider = 'Enhanced Demo Data';
        }
        
        // Remove duplicates and limit results
        const uniqueMentors = mentors
            .filter((mentor, index, self) => 
                index === self.findIndex(m => m.name === mentor.name)
            )
            .slice(0, 20);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(200).json({
            mentors: uniqueMentors,
            provider: provider,
            total: uniqueMentors.length,
            quota: {
                serpapi: '100/month',
                scrapingbee: '1000/month', 
                rapidapi: '50/month',
                apollo: '5/month'
            }
        });

    } catch (error) {
        console.error('Function error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Always return demo data as final fallback
        const mentors = getEnhancedDemoData(req.body || {});
        
        return res.status(200).json({
            mentors: mentors,
            provider: 'Demo Data (API Error)',
            total: mentors.length,
            error: 'APIs temporarily unavailable'
        });
    }
}
