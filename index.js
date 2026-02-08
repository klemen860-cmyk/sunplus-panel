const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

// M3U Veri İşleme Motoru
async function parseM3U() {
    const response = await axios.get(M3U_URL);
    const lines = response.data.split('\n').filter(l => l.trim() !== "");
    let liveCats = [], vodCats = [], liveStreams = [], vodStreams = [];
    let cMap = new Map(), vMap = new Map(), sIdx = 1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF:')) {
            const info = lines[i];
            const sUrl = lines[i + 1] ? lines[i + 1].trim() : "";
            if (!sUrl.startsWith('http')) continue;

            let logo = info.includes('tvg-logo="') ? info.split('tvg-logo="')[1].split('"')[0] : "";
            let cName = info.includes('group-title="') ? info.split('group-title="')[1].split('"')[0] : "Genel";
            const isVod = sUrl.match(/\.(mp4|mkv|avi)$/i) || info.toLowerCase().includes('vod');

            if (isVod) {
                if (!vMap.has(cName)) {
                    vMap.set(cName, (vMap.size + 1).toString());
                    vodCats.push({ "category_id": vMap.get(cName), "category_name": cName });
                }
                vodStreams.push({
                    "num": sIdx, "name": info.split(',').pop().trim(), "stream_id": sIdx.toString(),
                    "category_id": vMap.get(cName), "container_extension": "mp4", "stream_icon": logo
                });
            } else {
                if (!cMap.has(cName)) {
                    cMap.set(cName, (cMap.size + 1).toString());
                    liveCats.push({ "category_id": cMap.get(cName), "category_name": cName });
                }
                liveStreams.push({
                    "num": sIdx, "name": info.split(',').pop().trim(), "stream_id": sIdx.toString(),
                    "category_id": cMap.get(cName), "container_extension": "ts", "stream_icon": logo
                });
            }
            sIdx++;
        }
    }
    return { liveCats, vodCats, liveStreams, vodStreams, rawM3U: response.data };
}

// 1. GET WHOLE STREAMS M3U (get.php)
app.get('/get.php', async (req, res) => {
    try {
        const data = await parseM3U();
        res.setHeader('Content-Type', 'application/x-mpegurl');
        res.send(data.rawM3U);
    } catch (e) { res.status(500).send("Error"); }
});

// 2. PLAYER API (player_api.php)
app.get(['/player_api.php', '/'], async (req, res) => {
    const { action, category_id, username, password } = req.query;
    try {
        const data = await parseM3U();

        // Login Bilgisi
        if (!action) {
            return res.json({
                "user_info": { "username": username, "status": "Active", "exp_date": "1893456000" },
                "server_info": { "url": req.hostname, "port": "80", "server_protocol": "http" }
            });
        }

        // Live, VOD ve Seri Kategorileri
        if (action === 'get_live_categories') return res.json(data.liveCats);
        if (action === 'get_vod_categories') return res.json(data.vodCats);
        if (action === 'get_series_categories') return res.json([]);

        // Yayın Listeleri
        if (action === 'get_live_streams') {
            let list = (category_id && category_id !== "0") ? data.liveStreams.filter(s => s.category_id === category_id) : data.liveStreams;
            return res.json(list);
        }
        if (action === 'get_vod_streams') {
            let list = (category_id && category_id !== "0") ? data.vodStreams.filter(s => s.category_id === category_id) : data.vodStreams;
            return res.json(list);
        }

        res.json([]);
    } catch (e) { res.status(500).send("API Error"); }
});

// 3. STREAM REDIRECT (live/movie/series)
app.get(['/live/:u/:p/:id', '/movie/:u/:p/:id'], async (req, res) => {
    try {
        const streamId = parseInt(req.params.id.split('.')[0]);
        const responseM3U = await axios.get(M3U_URL);
        const streams = responseM3U.data.split('\n').filter(l => l.trim().startsWith('http'));
        const targetUrl = streams[streamId - 1].trim();

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.redirect(302, targetUrl);
    } catch (e) { res.status(404).send("Not Found"); }
});

app.listen(PORT, () => console.log(`Xtream API Server Running`));
