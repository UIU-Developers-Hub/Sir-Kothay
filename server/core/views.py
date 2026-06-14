import json
import os
import urllib.error
import urllib.request

from django.http import JsonResponse
from django.utils import timezone


def _contributors_repo():
    return os.getenv('GITHUB_CONTRIBUTORS_REPO', 'UIU-Developers-Hub/Sir-Kothay')


def fetch_contributors():
    contributors_url = (
        f'https://api.github.com/repos/{_contributors_repo()}/contributors'
    )
    contributors = []
    try:
        with urllib.request.urlopen(contributors_url, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            for user in data:
                login = user['login']
                profile_url = user['html_url']
                image_url = user['avatar_url']
                user_url = f'https://api.github.com/users/{login}'
                try:
                    with urllib.request.urlopen(user_url, timeout=15) as user_response:
                        user_data = json.loads(user_response.read().decode('utf-8'))
                        name = user_data.get('name', login)
                        bio = user_data.get('bio', '')
                        location = user_data.get('location', '')
                        company = user_data.get('company', '')
                        blog = user_data.get('blog', '')
                        followers = user_data.get('followers', 0)
                        public_repos = user_data.get('public_repos', 0)
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
                    name = login
                    bio = ''
                    location = ''
                    company = ''
                    blog = ''
                    followers = 0
                    public_repos = 0
                contributors.append({
                    'login': login,
                    'profileUrl': profile_url,
                    'imageUrl': image_url,
                    'name': name,
                    'bio': bio,
                    'location': location,
                    'company': company,
                    'blog': blog,
                    'followers': followers,
                    'public_repos': public_repos
                })
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
        contributors = []
    return contributors


def index_view(request):
    return JsonResponse({
        'message': 'Sir Kothay API Server',
        'version': '1.0',
        'documentation': '/api/',
        'endpoints': {
            'auth': '/api/auth/',
            'dashboard': '/api/dashboard/',
            'qrcode': '/api/qrcode/',
            'broadcast': '/api/broadcast/'
        }
    }, status=200)


def about_view(request):
    contributors = fetch_contributors()
    return JsonResponse({
        'project': 'Sir Kothay',
        'description': 'Leave notes when you\'re away',
        'repository': f'https://github.com/{_contributors_repo()}',
        'contributors': contributors
    }, status=200)


def health_view(request):
    return JsonResponse({
        'status': 'ok',
        'service': 'sir-kothay',
        'server_time': timezone.now().isoformat(),
    }, status=200)
