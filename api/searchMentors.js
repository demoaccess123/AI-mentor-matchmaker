const fetch = require('node-fetch');

// API configurations
const RAPIDAPI_CONFIG = {
    host: 'linkedin-data-api.p.rapidapi.com',
    endpoints: {
        search: '/people-search'
    }
};

const APOLLO_CONFIG = {
    baseUrl: 'https://api.apollo.io/v1',
    endpoints: {
        search: '/people/search'
    }
};

// Helper function to search via RapidAPI
async function searchRapidAPI(filters) {
    try {
        let url = `https://${RAPIDAPI_CONFIG.host}${RAPIDAPI_CONFIG.endpoints.search}?`;
        
        const params = new URLSearchParams();
        if (filters.role) params.append('title', filters.role);
        if (filters.industry) params.append('industry', filters.industry);
        if (filters.country) params.append('location', filters.country);
        if (filters.college) params.append('school', filters.college);
        
        url += params.toString();

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_CONFIG.host
            }
        });

        if (!response.ok) {
            throw new Error(`RapidAPI error: ${response.status}`);
        }

        const data = await response.json();
        return normalizeRapidAPIData(data);

    } catch (error) {
        console.error('RapidAPI search failed:', error);
        return null;
    }
}

// Helper function to search via Apollo.io
async function searchApollo(filters) {
    try {
        const searchParams = {
            page: 1,
            per_page: 10
        };

        if (filters.role) {
            searchParams.person_titles = [filters.role];
        }
        if (filters.industry) {
            searchParams.person_industry_tag_names = [filters.industry];
        }
        if (filters.country) {
            searchParams.person_locations = [filters.country];
        }

        const response = await fetch(`${APOLLO_CONFIG.baseUrl}${APOLLO_CONFIG.endpoints.search}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': process.env.APOLLO_KEY
            },
            body: JSON.stringify(searchParams)
        });

        if (!response.ok) {
            throw new Error(`Apollo error: ${response.status}`);
        }

        const data = await response.json();
        return normalizeApolloData(data);

    } catch (error) {
        console.error('Apollo search failed:', error);
        return null;
    }
}

// Data normalization functions
function normalizeRapidAPIData(data) {
    if (!data || !data.results) return [];
    
    return data.results.map(person => ({
        id: person.linkedin_id || person.profile_id,
        name: person.full_name || `${person.first_name} ${person.last_name}`,
        headline: person.headline || person.title,
        company: person.company,
        location: person.location,
        industry: person.industry,
        skills: person.skills || [],
        summary: person.summary,
        linkedinUrl: person.linkedin_url || person.profile_url
    }));
}

function normalizeApolloData(data) {
    if (!data || !data.people) return [];
    
    return data.people.map(person => ({
        id: person.id,
        name: person.name,
        headline: person.title,
        company: person.organization && person.organization.name,
        location: person.city && person.state ? `${person.city}, ${person.state}` : person.country,
        industry: person.organization && person.organization.industry,
        skills: [], // Apollo doesn't provide skills in free tier
        summary: person.headline,
        linkedinUrl: person.linkedin_url
    }));
}

// Fallback to demo data if all APIs fail
function getFallbackData(filters) {
    const demoMentors = [
        {
            id: 'demo-1',
            name: 'Sarah Johnson',
            headline: 'Senior Product Manager at Tech Corp',
            company: 'Tech Corp',
            location: 'San Francisco, CA',
            industry: 'Technology',
            skills: ['Product Management', 'Strategy', 'Analytics', 'Leadership'],
            summary: 'Experienced product manager with 8+ years in tech industry',
            linkedinUrl: '#'
        },
        {
            id: 'demo-2',
            name: 'Michael Chen',
            headline: 'Software Engineering Manager at Innovation Labs',
            company: 'Innovation Labs',
            location: 'New York, NY',
            industry: 'Technology',
            skills: ['Software Development', 'Team Leadership', 'Architecture', 'Mentoring'],
            summary: 'Passionate about building great software and developing talent',
            linkedinUrl: '#'
        },
        {
            id: 'demo-3',
            name: 'Emily Rodriguez',
            headline: 'Marketing Director at Global Solutions',
            company: 'Global Solutions',
            location: 'Chicago, IL',
            industry: 'Marketing',
            skills: ['Digital Marketing', 'Brand Strategy', 'Analytics', 'Team Management'],
            summary: 'Marketing leader with expertise in digital transformation',
            linkedinUrl: '#'
        }
    ];

    // Filter demo data based on search criteria
    return demoMentors.filter(mentor => {
        if (filters.industry && !mentor.industry.toLowerCase().includes(filters.industry.toLowerCase())) {
            return false;
        }
        if (filters.role && !mentor.headline.toLowerCase().includes(filters.role.toLowerCase())) {
            return false;
        }
        return true;
    });
}

// Main handler function for Vercel
export default async function handler(req, res) {
    // Handle CORS
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
        let mentors = null;
        let provider = '';

        // Try RapidAPI first
        if (process.env.RAPIDAPI_KEY) {
            mentors = await searchRapidAPI(filters);
            if (mentors && mentors.length > 0) {
                provider = 'RapidAPI';
            }
        }

        // Fallback to Apollo.io
        if ((!mentors || mentors.length === 0) && process.env.APOLLO_KEY) {
            mentors = await searchApollo(filters);
            if (mentors && mentors.length > 0) {
                provider = 'Apollo.io';
            }
        }

        // Final fallback to demo data
        if (!mentors || mentors.length === 0) {
            mentors = getFallbackData(filters);
            provider = 'Demo Data';
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(200).json({
            mentors: mentors,
            provider: provider,
            total: mentors.length
        });

    } catch (error) {
        console.error('Function error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
