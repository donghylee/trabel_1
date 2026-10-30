/**
 * 올린 사진을 긴 변 maxSide px 이하 JPEG data URL로 줄인다.
 * 서버 없이 localStorage에 넣어야 해서 크기를 작게 유지.
 */
export function resizeImage(file: File, maxSide = 1080, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽지 못했습니다.'))
    }
    img.src = url
  })
}
