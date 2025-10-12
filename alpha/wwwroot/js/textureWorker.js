// Worker: fetch -> createImageBitmap -> transfer
self.addEventListener('message', async (ev) => {
    const data = ev.data;
    if (!data) return;
    if (data.type === 'decode') {
        const { url, id } = data;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const bitmap = await createImageBitmap(blob);
            self.postMessage({ id, bitmap }, [bitmap]);
        } catch (err) {
            self.postMessage({ id, error: (err && err.message) ? err.message : String(err) });
        }
    }
});
