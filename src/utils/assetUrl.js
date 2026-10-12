// public/ 폴더의 파일 경로를 배포 위치에 맞게 바꾼다.
// 로컬 개발은 '/', GitHub Pages는 '/SolarGrid/' 아래에서 서비스되므로 BASE_URL을 앞에 붙인다.
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
