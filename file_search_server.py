
import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # 유저스크립트에서 접근할 수 있도록 CORS 설정

# 검색할 루트 디렉토리 설정 (예: 사용자의 문서 폴더 등)
SEARCH_ROOTS = [
        r'e:\SynologyDrive',
        r'f:\Joy\[BOOK]',
        ]

@app.route('/search', methods=['GET'])
def search_files():
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "검색어를 입력해주세요."}), 400

    # 요청 받은 단어를 구분문자로 쪼개기 (정규식 사용)
    # 빈칸, (), [], *, - 등을 구분자로 사용하여 단어 리스트 추출
    keywords = re.split(r'[\s\(\)\[\]\*\-]+', query)
    keywords = [k.lower() for k in keywords if k] # 빈 문자열 제거 및 소문자화

    results = []
    
    # 디렉토리 순회 및 검색
    global dirs
    for root_dir in SEARCH_ROOTS:
        if not os.path.exists(root_dir):
            continue # 경로가 존재하지 않으면 건너띔

        for root, dirs, files in os.walk(root_dir):
            for filename in files:
                file_lower = filename.lower()
                # 모든 키워드가 파일명에 포함되는지 확인
                if all(keyword in file_lower for keyword in keywords):
                    results.append(filename)
                
    return jsonify({"files": results})

if __name__ == '__main__':
    # 5000번 포트로 서버 실행
    app.run(port=5000)
