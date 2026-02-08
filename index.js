const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

async function getM3UData() {
    const response = await axios.get(M3U_URL);
    const lines = response.data.split('\n').filter(l => l.trim() !== "");
    let liveCats = [], vodCats = [], liveStreams = [], vodStreams = [];
    let cMap = new Map(), vMap = new Map();
    let sIdx = 1, vIdx = 1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF:')) {
            const info = lines[i];
            const sUrl = lines[i + 1] ? lines[i + 1].trim() : "";
            if (!sUrl || !sUrl.startsWith('http')) continue;

            let cName = info.includes('group-title="') ? info.split('group-title="')[1].split('"')[0] : "Genel";
            
            // FİLM Mİ CANLI MI AYRIMI (Genelde VOD, Sinema gibi kelimelerden anlarız)
            // Eğer m3u dosyan çok karışıksa, uzantıya bakıyoruz (.mp4, .mkv, .avi filmdir)
            const isVod = sUrl.match(/\.(mp4|mkv|avi|mov)$/i) || info.toLowerCase().includes('vod') || info.toLowerCase().includes('sinema');

            if (isVod) {
                if (!vMap.has(cName)) {
                    let cId = (vMap.size + 1).toString();
                    vMap.set(cName, cId);
                    vodCats.push({ "category_id": cId, "category_name": cName });
                }
                vodStreams.push({
                    "num": vIdx,
                    "name": info.split(',').pop().trim(),
                    "stream_id": vIdx.toString(),
                    "category_id": vMap.get(cName),
                    "container_extension": sUrl.split('.').pop() || "mp4"
                });
                vIdx++;
            } else {
                if (!cMap.has(cName)) {
                    let cId = (cMap.size + 1).toString();
                    cMap.set(cName, cId);
                    liveCats.push({ "category_id": cId, "category_name": cName });
                }
                liveStreams.push({
                    "num": sIdx,
                    "name": info.split(',').pop().trim(),
                    "stream_id": sIdx.toString(),
                    "category_id": cMap.get(cName),
                    "container_extension": "ts"
                });
                sIdx++;
            }
        }
    }
    return { liveCats, vodCats, liveStreams, vodStreams, rawLines: lines };
}

app.get(['/', '/get.php', '/player_api.php'], async (req, res) => {
    const { action, category_id } = req.query;

    try {
        const data = await getM3UData();

        // CANLI YAYINLAR
        if (action === 'get_live_categories') return res.json(data.liveCats);
        if (action === 'get_live_streams') {
            let list = (category_id && category_id !== "0") ? data.liveStreams.filter(s => s.category_id === category_id) : data.liveStreams;
            return res.json(list);
        }

        // FİLMLER (VOD) - Dönme sorununu çözen kısım
        if (action === 'get_vod_categories') return res.json(data.vodCats);
        if (action === 'get_vod_streams') {
            let list = (category_id && category_id !== "0") ? data.vodStreams.filter(s => s.category_id === category_id) : data.vodStreams;
            return res.json(list);
        }

        // DİZİLER (Şimdilik boş gönderiyoruz ki cihaz takılmasın)
        if (action === 'get_series_categories') return res.json([]);
        if (action === 'get_series_streams') return res.json([]);

        // DEFAULT LOGIN
        return res.json({
            "user_info": { "status": "Active", "exp_date": "1893456000" },
            "server_info": { "url": req.hostname, "port": "80" }
        });

    } catch (e) { res.status(500).send("Error"); }
});

// YAYIN YÖNLENDİRME (Hem Canlı Hem Film İçin)
app.get(['/live/:u/:p/:id', '/movie/:u/:p/:id'], async (req, res) => {
    const streamId = parseInt(req.params.id.split('.')[0]);
    const response = await axios.get(M3U_URL);
    const lines = response.data.split('\n').filter(l => l.trim().startsWith('http'));
    
    if (lines[streamId - 1]) {
        return res.redirect(lines[streamId - 1].trim());
    }
    res.status(404).send("Not Found");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
