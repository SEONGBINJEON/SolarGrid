import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")

key = os.getenv("KAKAO_REST_API_KEY")
print("key exists:", bool(key))
print("key length:", len(key) if key else 0)

url = "https://dapi.kakao.com/v2/local/search/address.json"
headers = {"Authorization": f"KakaoAK {key}"}
params = {"query": "전라남도 신안군 안좌면 방월리 829"}

r = requests.get(url, headers=headers, params=params, timeout=10)

print("status:", r.status_code)
print(r.text[:1000])