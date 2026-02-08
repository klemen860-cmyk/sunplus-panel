const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

async function getM3UData() {
    const response = await axios.get(M3U_URL);
    const lines = response.data.split('\n').filter(l => l.trim() !== "");
    let liveCats = [], vodCats = [], liveStreams = [], vodStreams = [];
    let cMap = new Map(), vMap = new Map(), sIdx = 1, vIdx = 1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF:')) {
            const info = lines[i];
            const sUrl = lines[i + 1] ? lines[i + 1].trim() : "";
            if (!sUrl || !sUrl.startsWith('http')) continue;

            let logo = info.includes('tvg-logo="') ? info.split('tvg-logo="')[1].split('"')[0] : "";
            let cName = info.includes('group-title="') ? info.split('group-title="')[1].split('"')[0] : "Genel";
            
            // Link m3u8 mi ts mi tespit et
            const isM3u8 = sUrl.includes('.m3u8');
            const ext = isM3u8 ? "m3u8" : "ts";
            
            const isVod = sUrl.match(/\.(mp4|mkv|avi|mov)$/i) || info.toLowerCase().includes('vod');

            if (isVod) {
                if (!vMap.has(cName)) {
                    let cId = (vMap.size + 1).toString();
                    vMap.set(cName, cId);
                    vodCats.push({ "category_id": cId, "category_name": cName });
                }
                vodStreams.push({
                    "num": vIdx, "name": info.split(',').pop().trim(), "stream_id": vIdx.toString(),
                    "category_id": vMap.get(cName), "container_extension": "mp4", "stream_icon": logo
                });
                vIdx++;
            } else {
                if (!cMap.has(cName)) {
                    let cId = (cMap.size + 1).toString();
                    cMap.set(cName, cId);
                    liveCats.push({ "category_id": cId, "category_name": cName });
                }
                liveStreams.push({
                    "num": sIdx, "name": info.split(',').pop().trim(), "stream_id": sIdx.toString(),
                    "category_id": cMap.get(cName), "container_extension": ext, "stream_icon": logo
                });
                sIdx++;
            }
        }
    }
    return { liveCats, vodCats, liveStreams, vodStreams };
}

app.get(['/', '/get.php', '/player_api.php'], async (req, res) => {
    const { action, category_id } = req.query;
    try {
        const data = await getM3UData();
        if (action === 'get_live_categories') return res.json(data.liveCats);
        if (action === 'get_live_streams') {
            let list = (category_id && category_id !== "0") ? data.liveStreams.filter(s => s.category_id === category_id) : data.liveStreams;
            return res.json(list);
        }
        if (action === 'get_vod_categories') return res.json(data.vodCats);
        if (action === 'get_vod_streams') {
            let list = (category_id && category_id !== "0") ? data.vodStreams.filter(s => s.category_id === category_id) : data.vodStreams;
            return res.json(list);
        }
        return res.json({ "user_info": { "status": "Active" }, "server_info": { "url": req.hostname, "port": "80" } });
    } catch (e) { res.status(500).send("API Error"); }
});

// YÖNLENDİRME (Redirect) - Çoğu Sunplus ve IPTVnator sürümü için en temizi budur
app.get(['/live/:u/:p/:id', '/movie/:u/:p/:id'], async (req, res) => {
    try {
        const streamId = parseInt(req.params.id.split('.')[0]);
        const responseM3U = await axios.get(M3U_URL);
        const streams = responseM3U.data.split('\n').filter(l => l.trim().startsWith('http'));
        const targetUrl = streams[streamId - 1].trim();

        // 302 yönlendirmesi gönderiyoruz ama Header'ları temizliyoruz
        res.status(302).setHeader('Location', targetUrl);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end();
    } catch (e) { res.status(500).send("Stream Error"); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
