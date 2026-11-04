(function (root) {
  const maxBytes = 500_000;

  // 重新編碼為 JPEG 會一併移除 EXIF（含定位）資訊。
  async function compress(file) {
    if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔案。');
    if (file.size > 25_000_000) throw new Error('照片檔案過大，請改選另一張。');

    let bitmap;
    let sourceUrl;
    try {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        sourceUrl = URL.createObjectURL(file);
        bitmap = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = sourceUrl;
        });
      }
    } catch {
      throw new Error('此照片格式無法處理，請改用拍照或 JPEG／PNG 圖片。');
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }

    const canvas = document.createElement('canvas');
    try {
      let longestEdge = 1280;
      while (longestEdge >= 160) {
        const scale = Math.min(1, longestEdge / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('瀏覽器無法處理照片，請改用其他瀏覽器。');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.82, 0.7, 0.55]) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
          if (!blob || blob.type !== 'image/jpeg') throw new Error('無法壓縮照片，請改選另一張。');
          if (blob.size > 0 && blob.size <= maxBytes) return blob;
        }
        longestEdge = Math.floor(longestEdge * 0.75);
      }
      throw new Error('照片檔案過大，請改選另一張。');
    } finally {
      bitmap.close?.();
      canvas.width = canvas.height = 1;
    }
  }

  root.ScreeningPhoto = { compress, maxBytes };
})(window);
