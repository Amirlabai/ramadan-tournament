// Tournament App - Main JavaScript
(function () {
    'use strict';

    // Data storage
    let teams = [];
    let matches = [];
    let standings = [];
    let topScorers = [];
    let playerStats = [];
    let news = [];

    // Initialize app
    document.addEventListener('DOMContentLoaded', function () {
        loadAllData();
    });

    // Load all JSON data
    async function loadAllData() {
        try {
            const [teamsData, matchesData, standingsData, scorersData, newsData] = await Promise.all([
                fetch('data/teams.json').then(r => r.json()),
                fetch('data/matches.json').then(r => r.json()),
                fetch('data/standings.json').then(r => r.json()),
                fetch('data/top_scorers.json').then(r => r.json()),
                fetch('data/news.json').then(r => r.json())
            ]);

            teams = teamsData;
            matches = matchesData;
            standings = standingsData;
            topScorers = scorersData;
            news = newsData;

            renderAll();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Render all content
    function renderAll() {
        renderNewsBanner();
        renderDashboard();
        renderTeams();
        renderSchedule();
        renderPlayers();
        renderStats();
    }

    // Render news banner
    function renderNewsBanner() {
        const banner = document.getElementById('newsBanner');
        if (!banner || news.length === 0) return;

        const latestNews = news.filter(n => n.priority === 'high').slice(0, 1)[0] || news[0];
        banner.innerHTML = `
            <h4>${latestNews.title}</h4>
            <p>${latestNews.message}</p>
        `;
    }

    // Render dashboard
    function renderDashboard() {
        // Next match
        const nextMatch = matches.find(m => m.score1 === null || m.score2 === null);
        const nextMatchCard = document.getElementById('nextMatchCard');

        if (nextMatch) {
            const team1 = teams.find(t => t.id === nextMatch.team1_id);
            const team2 = teams.find(t => t.id === nextMatch.team2_id);
            nextMatchCard.innerHTML = `
                <div class="match-teams">
                    <span>${team1 ? team1.name : 'TBD'}</span>
                    <span style="color: var(--secondary-yellow); font-weight: 700;">VS</span>
                    <span>${team2 ? team2.name : 'TBD'}</span>
                </div>
                <p class="mt-3 mb-0"><strong>Date:</strong> ${nextMatch.date}</p>
                <p class="mb-0"><strong>Location:</strong> ${nextMatch.location}</p>
            `;
        } else {
            nextMatchCard.innerHTML = '<p>No upcoming matches</p>';
        }

        // Top scorer
        const topScorerCard = document.getElementById('topScorerCard');
        if (topScorers.length > 0) {
            const topScorer = topScorers[0];
            topScorerCard.innerHTML = `
                <h3 style="color: var(--primary-green);">${topScorer.name}</h3>
                <p><strong>Team:</strong> ${topScorer.team}</p>
                <p><strong>Goals:</strong> <span style="font-size: 24px; color: var(--secondary-yellow); font-weight: 700;">${topScorer.goals}</span></p>
            `;
        }

        // Recent results
        const recentResults = document.getElementById('recentResults');
        const completedMatches = matches.filter(m => m.score1 !== null && m.score2 !== null).slice(-3).reverse();

        if (completedMatches.length > 0) {
            recentResults.innerHTML = completedMatches.map(match => {
                const team1 = teams.find(t => t.id === match.team1_id);
                const team2 = teams.find(t => t.id === match.team2_id);
                return `
                    <div class="match-result mb-2 pb-2 border-bottom">
                        <div class="match-teams">
                            <span>${team1 ? team1.name : 'TBD'}</span>
                            <span class="match-score">${match.score1} - ${match.score2}</span>
                            <span>${team2 ? team2.name : 'TBD'}</span>
                        </div>
                        <small class="text-muted">${match.date}</small>
                    </div>
                `;
            }).join('');
        }
    }

    // Render teams
    function renderTeams() {
        const teamsTableBody = document.getElementById('teamsTableBody');

        teamsTableBody.innerHTML = teams.map(team => {
            return `
                <tr class="team-row" data-team-id="${team.id}" onclick="toggleTeamRow(${team.id})" style="cursor: pointer;">
                    <td><strong>${team.name}</strong></td>
                    <td>${team.coach}</td>
                    <td>${team.members.length} players</td>
                    <td><i class="expand-icon">▼</i></td>
                </tr>
                <tr class="team-details-row" id="team-details-${team.id}" style="display: none;">
                    <td colspan="4" style="background-color: var(--light-gray); padding: 20px;">
                        <h5 style="color: var(--primary-green); margin-bottom: 15px;">Team Roster</h5>
                        <div class="row">
                            ${team.members.map(member => `
                                <div class="col-6 col-md-4 col-lg-3 mb-3">
                                    <div class="roster-player-card">
                                        <span class="badge bg-secondary">${member.number}</span>
                                        <strong>${member.nickname || member.name}</strong>
                                        <small class="d-block text-muted">${member.position}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Toggle team row expansion
    window.toggleTeamRow = function (teamId) {
        const detailsRow = document.getElementById(`team-details-${teamId}`);
        const teamRow = document.querySelector(`tr[data-team-id="${teamId}"]`);
        const icon = teamRow.querySelector('.expand-icon');

        if (detailsRow.style.display === 'none') {
            // Close all other rows first
            document.querySelectorAll('.team-details-row').forEach(row => {
                row.style.display = 'none';
            });
            document.querySelectorAll('.team-row .expand-icon').forEach(i => {
                i.textContent = '▼';
            });

            // Open this row
            detailsRow.style.display = 'table-row';
            icon.textContent = '▲';
        } else {
            // Close this row
            detailsRow.style.display = 'none';
            icon.textContent = '▼';
        }
    };

    // Render schedule
    function renderSchedule() {
        const scheduleTimeline = document.getElementById('scheduleTimeline');
        scheduleTimeline.innerHTML = matches.map(match => {
            const team1 = teams.find(t => t.id === match.team1_id);
            const team2 = teams.find(t => t.id === match.team2_id);
            const isUpcoming = match.score1 === null || match.score2 === null;

            return `
                <div class="match-item ${isUpcoming ? 'upcoming' : ''}">
                    <div class="match-date">${match.date} - ${match.location}</div>
                    <div class="match-teams">
                        <span>${team1 ? team1.name : 'TBD'}</span>
                        ${isUpcoming
                    ? '<span style="color: var(--secondary-yellow); font-weight: 700;">VS</span>'
                    : `<span class="match-score">${match.score1} - ${match.score2}</span>`
                }
                        <span>${team2 ? team2.name : 'TBD'}</span>
                    </div>
                    ${match.goals && match.goals.length > 0 ? `
                        <div class="mt-2">
                            <small class="text-muted">Goals: ${match.goals.map(g => {
                    const scorer = findPlayer(g.member_id);
                    return `${scorer ? scorer.nickname || scorer.name : 'Unknown'} (${g.minute}')`;
                }).join(', ')}</small>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Render players
    function renderPlayers() {
        const playersTableBody = document.getElementById('playersTableBody');
        const allPlayers = teams.flatMap(team =>
            team.members.map(member => ({ ...member, team_name: team.name, team_id: team.id }))
        );

        console.log('Rendering players:', allPlayers.length, 'players');
        console.log('Teams data:', teams.length, 'teams');
        console.log('Table body element:', playersTableBody);

        playersTableBody.innerHTML = allPlayers.map((player, idx) => {
            const playerGoals = topScorers.find(s => s.member_id === player.id)?.goals || 0;

            return `
                <tr class="player-row" data-player-id="${player.id}" onclick="togglePlayerRow(${player.id})" style="cursor: pointer;">
                    <td><span class="badge bg-secondary">${player.number}</span></td>
                    <td><strong>${player.name}</strong></td>
                    <td>${player.nickname || '-'}</td>
                    <td>${player.team_name}</td>
                    <td>${player.position}</td>
                    <td><i class="expand-icon">▼</i></td>
                </tr>
                <tr class="player-details-row" id="details-${player.id}" style="display: none;">
                    <td colspan="6" style="background-color: var(--light-gray); padding: 20px;">
                        <div class="row">
                            <div class="col-md-3 text-center">
                                <div class="player-card-template mx-auto" style="width: 120px; height: 160px;">
                                    <img src="assets/images/player_template.png" alt="Player" class="player-body" onerror="this.style.display='none'">
                                </div>
                                <div class="player-number-overlay">${player.number}</div>
                            </div>
                            <div class="col-md-9">
                                <h4 style="color: var(--primary-green);">${player.nickname || player.name}</h4>
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Full Name:</strong> ${player.name}</p>
                                        <p><strong>Team:</strong> ${player.team_name}</p>
                                        <p><strong>Number:</strong> ${player.number}</p>
                                        <p><strong>Position:</strong> ${player.position}</p>
                                        <p><strong>Age:</strong> ${player.age}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h5>Statistics</h5>
                                        <p><strong>Goals:</strong> <span style="color: var(--primary-green); font-size: 20px; font-weight: 700;">${playerGoals}</span></p>
                                        ${player.bio ? `<p class="mt-3"><em>${player.bio}</em></p>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Toggle player row expansion
    window.togglePlayerRow = function (playerId) {
        const detailsRow = document.getElementById(`details-${playerId}`);
        const playerRow = document.querySelector(`tr[data-player-id="${playerId}"]`);
        const icon = playerRow.querySelector('.expand-icon');

        if (detailsRow.style.display === 'none') {
            // Close all other rows first
            document.querySelectorAll('.player-details-row').forEach(row => {
                row.style.display = 'none';
            });
            document.querySelectorAll('.expand-icon').forEach(i => {
                i.textContent = '▼';
            });

            // Open this row
            detailsRow.style.display = 'table-row';
            icon.textContent = '▲';
        } else {
            // Close this row
            detailsRow.style.display = 'none';
            icon.textContent = '▼';
        }
    };

    // Render stats
    function renderStats() {
        // Standings
        const standingsBody = document.getElementById('standingsBody');
        standingsBody.innerHTML = standings.map((team, idx) => `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td>${team.team_name}</td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.drawn}</td>
                <td>${team.lost}</td>
                <td>${team.goals_for}</td>
                <td>${team.goals_against}</td>
                <td>${team.goal_diff}</td>
                <td><strong style="color: var(--primary-green);">${team.points}</strong></td>
            </tr>
        `).join('');

        // Top scorers
        const scorersBody = document.getElementById('scorersBody');
        scorersBody.innerHTML = topScorers.map((scorer, idx) => `
            <tr ${idx === 0 ? 'style="background-color: rgba(255, 255, 0, 0.1);"' : ''}>
                <td><strong>${idx + 1}</strong></td>
                <td>${scorer.name}</td>
                <td>${scorer.team}</td>
                <td>${scorer.position}</td>
                <td><strong style="color: var(--primary-green); font-size: 18px;">${scorer.goals}</strong></td>
            </tr>
        `).join('');

        // Initialize DataTables
        if ($.fn.DataTable) {
            $('#scorersTable').DataTable({
                paging: false,
                searching: true,
                info: false,
                order: [[4, 'desc']]
            });
        }
    }

    // Helper: Find player by ID
    function findPlayer(playerId) {
        for (const team of teams) {
            const player = team.members.find(m => m.id === playerId);
            if (player) return { ...player, team_name: team.name };
        }
        return null;
    }

    // Show player modal
    window.showPlayerModal = function (playerId) {
        const player = findPlayer(playerId);
        if (!player) return;

        const playerGoals = topScorers.find(s => s.member_id === playerId)?.goals || 0;

        const modalTitle = document.getElementById('playerModalTitle');
        const modalBody = document.getElementById('playerModalBody');

        modalTitle.textContent = player.name || player.nickname;
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-4 text-center">
                    <div class="player-card-template mx-auto">
                        <img src="assets/images/player_template.png" alt="Player" class="player-body" onerror="this.style.display='none'">
                        <div class="player-number-overlay">${player.number}</div>
                    </div>
                </div>
                <div class="col-md-8">
                    <h4 style="color: var(--primary-green);">${player.nickname || player.name}</h4>
                    <p><strong>Full Name:</strong> ${player.name}</p>
                    <p><strong>Team:</strong> ${player.team_name}</p>
                    <p><strong>Number:</strong> ${player.number}</p>
                    <p><strong>Position:</strong> ${player.position}</p>
                    <p><strong>Age:</strong> ${player.age}</p>
                    <hr>
                    <h5>Statistics</h5>
                    <p><strong>Goals:</strong> <span style="color: var(--primary-green); font-size: 20px;">${playerGoals}</span></p>
                    ${player.bio ? `<p class="mt-3"><em>${player.bio}</em></p>` : ''}
                </div>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('playerModal'));
        modal.show();
    };

})();
