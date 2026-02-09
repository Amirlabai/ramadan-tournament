#!/usr/bin/env python3
"""
Tournament Statistics Engine
Processes match data and generates tournament standings, player statistics, and bracket data.
"""

import json
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path


class Team:
    """Represents a team in the tournament."""
    def __init__(self, team_id: int, name: str, logo: str, coach: str, members: List[Dict]):
        self.id = team_id
        self.name = name
        self.logo = logo
        self.coach = coach
        self.members = members


class Match:
    """Represents a match between two teams."""
    def __init__(self, match_data: Dict[str, Any]):
        self.id = match_data['id']
        self.date = match_data['date']
        self.location = match_data.get('location', '')
        self.team1_id = match_data['team1_id']
        self.team2_id = match_data['team2_id']
        self.score1 = match_data.get('score1')
        self.score2 = match_data.get('score2')
        self.goals = match_data.get('goals', [])
        self.phase = match_data.get('phase', 'group')  # 'group' or 'knockout'


class TournamentEngine:
    """Main engine for calculating tournament statistics."""
    
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = Path(data_dir)
        self.teams: Dict[int, Team] = {}
        self.matches: List[Match] = []
        self.members: Dict[int, Dict] = {}
        
    def load_data(self):
        """Load teams and matches from JSON files."""
        # Load teams
        teams_file = self.data_dir / 'teams.json'
        if teams_file.exists():
            with open(teams_file, 'r', encoding='utf-8') as f:
                teams_data = json.load(f)
                for team_data in teams_data:
                    team = Team(
                        team_data['id'],
                        team_data['name'],
                        team_data.get('logo', ''),
                        team_data.get('coach', ''),
                        team_data.get('members', [])
                    )
                    self.teams[team.id] = team
                    
                    # Index members
                    for member in team.members:
                        self.members[member['id']] = {
                            **member,
                            'team_id': team.id,
                            'team_name': team.name
                        }
        
        # Load matches
        matches_file = self.data_dir / 'matches.json'
        if matches_file.exists():
            with open(matches_file, 'r', encoding='utf-8') as f:
                matches_data = json.load(f)
                self.matches = [Match(m) for m in matches_data]
    
    def calculate_standings(self) -> List[Dict[str, Any]]:
        """Calculate team standings for group stage."""
        standings = {}
        
        # Initialize standings for all teams
        for team_id, team in self.teams.items():
            standings[team_id] = {
                'team_id': team_id,
                'team_name': team.name,
                'played': 0,
                'won': 0,
                'drawn': 0,
                'lost': 0,
                'goals_for': 0,
                'goals_against': 0,
                'goal_diff': 0,
                'points': 0
            }
        
        # Process group stage matches
        for match in self.matches:
            if match.phase != 'group' or match.score1 is None or match.score2 is None:
                continue
                
            team1_id = match.team1_id
            team2_id = match.team2_id
            
            if team1_id not in standings or team2_id not in standings:
                continue
            
            # Update matches played
            standings[team1_id]['played'] += 1
            standings[team2_id]['played'] += 1
            
            # Update goals
            standings[team1_id]['goals_for'] += match.score1
            standings[team1_id]['goals_against'] += match.score2
            standings[team2_id]['goals_for'] += match.score2
            standings[team2_id]['goals_against'] += match.score1
            
            # Determine result
            if match.score1 > match.score2:
                # Team 1 wins
                standings[team1_id]['won'] += 1
                standings[team1_id]['points'] += 3
                standings[team2_id]['lost'] += 1
            elif match.score1 < match.score2:
                # Team 2 wins
                standings[team2_id]['won'] += 1
                standings[team2_id]['points'] += 3
                standings[team1_id]['lost'] += 1
            else:
                # Draw
                standings[team1_id]['drawn'] += 1
                standings[team1_id]['points'] += 1
                standings[team2_id]['drawn'] += 1
                standings[team2_id]['points'] += 1
        
        # Calculate goal difference
        for team_id in standings:
            standings[team_id]['goal_diff'] = (
                standings[team_id]['goals_for'] - standings[team_id]['goals_against']
            )
        
        # Sort by points (descending), then goal difference (descending)
        standings_list = sorted(
            standings.values(),
            key=lambda x: (x['points'], x['goal_diff'], x['goals_for']),
            reverse=True
        )
        
        return standings_list
    
    def calculate_top_scorers(self) -> List[Dict[str, Any]]:
        """Calculate top scorers based on goals."""
        scorer_stats = {}
        
        # Count goals for each player
        for match in self.matches:
            for goal in match.goals:
                member_id = goal['member_id']
                if member_id not in scorer_stats:
                    member_info = self.members.get(member_id, {})
                    scorer_stats[member_id] = {
                        'member_id': member_id,
                        'name': member_info.get('name', 'Unknown'),
                        'team': member_info.get('team_name', 'Unknown'),
                        'position': member_info.get('position', 'Unknown'),
                        'goals': 0
                    }
                scorer_stats[member_id]['goals'] += 1
        
        # Sort by goals (descending)
        top_scorers = sorted(
            scorer_stats.values(),
            key=lambda x: x['goals'],
            reverse=True
        )
        
        return top_scorers
    
    def calculate_player_stats(self) -> List[Dict[str, Any]]:
        """Calculate detailed player statistics."""
        player_stats = {}
        
        # Initialize stats for all players
        for member_id, member in self.members.items():
            player_stats[member_id] = {
                'member_id': member_id,
                'goals': 0,
                'assists': 0,
                'yellow_cards': 0,
                'red_cards': 0,
                'games_played': 0
            }
        
        # Count goals
        for match in self.matches:
            team_players = set()
            
            # Track which players participated
            for goal in match.goals:
                member_id = goal['member_id']
                if member_id in player_stats:
                    player_stats[member_id]['goals'] += 1
                    team_players.add(member_id)
            
            # Mark games played for team members
            # (In a real system, you'd have lineup data)
            if match.score1 is not None and match.score2 is not None:
                for member_id in team_players:
                    player_stats[member_id]['games_played'] += 1
        
        return list(player_stats.values())
    
    def generate_bracket(self, standings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate knockout bracket based on standings."""
        bracket = {
            'phase': 'knockout',
            'winners_bracket': [],
            'consolation_bracket': []
        }
        
        if len(standings) < 4:
            return bracket
        
        # Generate quarterfinal matchups (1v8, 2v7, 3v6, 4v5)
        matchups = [
            (0, 7),  # 1st vs 8th
            (1, 6),  # 2nd vs 7th
            (2, 5),  # 3rd vs 6th
            (3, 4),  # 4th vs 5th
        ]
        
        match_id = 201  # Start knockout match IDs at 201
        for i, (seed1, seed2) in enumerate(matchups):
            if seed1 < len(standings) and seed2 < len(standings):
                bracket['winners_bracket'].append({
                    'round': 'quarterfinals',
                    'match_id': match_id + i,
                    'team1_seed': seed1 + 1,
                    'team1_id': standings[seed1]['team_id'],
                    'team1_name': standings[seed1]['team_name'],
                    'team2_seed': seed2 + 1,
                    'team2_id': standings[seed2]['team_id'],
                    'team2_name': standings[seed2]['team_name'],
                    'winner_id': None
                })
        
        return bracket
    
    def save_results(self):
        """Save all calculated results to JSON files."""
        standings = self.calculate_standings()
        top_scorers = self.calculate_top_scorers()
        player_stats = self.calculate_player_stats()
        bracket = self.generate_bracket(standings)
        
        # Save standings
        with open(self.data_dir / 'standings.json', 'w', encoding='utf-8') as f:
            json.dump(standings, f, indent=2, ensure_ascii=False)
        
        # Save top scorers
        with open(self.data_dir / 'top_scorers.json', 'w', encoding='utf-8') as f:
            json.dump(top_scorers, f, indent=2, ensure_ascii=False)
        
        # Save player stats
        with open(self.data_dir / 'player_stats.json', 'w', encoding='utf-8') as f:
            json.dump(player_stats, f, indent=2, ensure_ascii=False)
        
        # Save bracket
        with open(self.data_dir / 'bracket.json', 'w', encoding='utf-8') as f:
            json.dump(bracket, f, indent=2, ensure_ascii=False)
        
        print("Statistics updated successfully!")
        print(f"  - {len(standings)} teams in standings")
        print(f"  - {len(top_scorers)} players with goals")
        print(f"  - {len(player_stats)} player records")
        print(f"  - Bracket generated with {len(bracket['winners_bracket'])} matches")


def main():
    """Main entry point."""
    print("Tournament Statistics Engine")
    print("=" * 50)
    
    engine = TournamentEngine()
    engine.load_data()
    engine.save_results()
    
    print("\nDone! JSON files updated in the 'data' directory.")


if __name__ == '__main__':
    main()
