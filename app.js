document.addEventListener('DOMContentLoaded', () => {
    // Check if access token exists in localStorage
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken) {
        // Hide the "Connect to Calendly" button after authentication
        document.getElementById('connect-btn').style.display = 'none';

        // Fetch the organization from localStorage and get events
        const organization = localStorage.getItem('organization');
        fetchScheduledEvents(accessToken, organization);
    }

    document.getElementById('connect-btn').addEventListener('click', () => {
        // Redirect to Calendly OAuth login page
        window.location.href = `https://auth.calendly.com/oauth/authorize?client_id=4pp2Zwv1i2E6Fmb0S3MDvJLJP0YAfzlEaTOfLG9eglg&response_type=code&redirect_uri=http://localhost:5500&scope=default`;
    });
});

// Capture authorization code and fetch access token
const urlParams = new URLSearchParams(window.location.search);
const authCode = urlParams.get('code');

if (authCode) {
    // Exchange authorization code for an access token
    fetchAccessToken(authCode);
}

function fetchAccessToken(authCode) {
    fetch('https://auth.calendly.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: '4pp2Zwv1i2E6Fmb0S3MDvJLJP0YAfzlEaTOfLG9eglg',
            client_secret: '2Tjvkld_YGaM4n1Df4uNpypcQDMxqzwRwYSFnZ9XYU8',
            code: authCode,
            redirect_uri: 'http://localhost:5500',
        }),
    })
    .then(response => response.json())
    .then(data => {
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;
        const organization = data.organization;

        // Store the tokens and organization in local storage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('organization', organization);

        // Hide the connect button after authentication
        document.getElementById('connect-btn').style.display = 'none';

        // Fetch scheduled events using the new access token
        fetchScheduledEvents(accessToken, organization);
    })
    .catch(error => console.error('Error fetching OAuth token:', error));
}

function refreshToken(refreshToken) {
    return fetch('https://auth.calendly.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: '4pp2Zwv1i2E6Fmb0S3MDvJLJP0YAfzlEaTOfLG9eglg',
            client_secret: '2Tjvkld_YGaM4n1Df4uNpypcQDMxqzwRwYSFnZ9XYU8',
            refresh_token: refreshToken,
        }),
    })
    .then(response => response.json())
    .then(data => {
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;
        const organization = data.organization;

        // Update the stored tokens
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        return { newAccessToken, organization };
    })
    .catch(error => {
        console.error('Error refreshing token:', error);
        return null;
    });
}

function fetchScheduledEvents(accessToken, organization) {
    fetch(`https://api.calendly.com/scheduled_events?status=active&organization=${organization}&min_start_time=2023-01-01T00:00:00Z&max_start_time=2024-12-31T23:59:59Z`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (response.status === 401) {
            // Token is invalid or expired, attempt to refresh it
            const refreshToken = localStorage.getItem('refreshToken');
            return refreshToken(refreshToken).then(tokenData => {
                if (tokenData) {
                    // Retry the fetch with the new access token
                    return fetchScheduledEvents(tokenData.newAccessToken, tokenData.organization);
                }
            });
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.collection) {
            displayEvents(data.collection);
        }
    })
    .catch(error => console.error('Error fetching events:', error));
}

function displayEvents(events) {
    const eventsContainer = document.getElementById('events');
    eventsContainer.innerHTML = ''; // Clear previous events

    events.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.classList.add('event');
        eventElement.innerHTML = `
            <h3>${event.name}</h3>
            <p>Start Time: ${new Date(event.start_time).toLocaleString()}</p>
            <p>Status: ${event.status}</p>
            <button class="more-details-btn" data-id="${event.uri}">More Details</button>
            <div class="details-content" style="display: none;"></div>
        `;
        eventsContainer.appendChild(eventElement);
    });

    // Attach event listeners to each "More Details" button
    document.querySelectorAll('.more-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const eventId = e.target.getAttribute('data-id');
            const detailsDiv = e.target.nextElementSibling;
            
            if (detailsDiv.style.display === 'none') {
                fetchEventDetails(eventId, detailsDiv); // Pass the div to populate details
                detailsDiv.style.display = 'block'; // Show the details
            } else {
                detailsDiv.style.display = 'none'; // Hide the details on second click
            }
        });
    });
}

function fetchEventDetails(eventId, detailsDiv) {
    const accessToken = localStorage.getItem('accessToken');
    fetch(`${eventId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(event => {
        // Display event details within the corresponding div
        detailsDiv.innerHTML = `
            <p>Event Name: ${event.resource.name}</p>
            <p>Start Time: ${new Date(event.resource.start_time).toLocaleString()}</p>
            <p>End Time: ${new Date(event.resource.end_time).toLocaleString()}</p>
            <p>Status: ${event.resource.status}</p>
            <p>Attendee: ${event.resource.event_memberships[0].user_name} (${event.resource.event_memberships[0].user_email})</p>
            <p>Location: ${event.resource.location.type}</p>
            <p>Meeting Notes: ${event.resource.meeting_notes_plain || 'None'}</p>
        `;
    })
    .catch(error => console.error('Error fetching event details:', error));
}
