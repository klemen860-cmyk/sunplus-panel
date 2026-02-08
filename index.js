const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

// 1. API VERİLERİ (KATEGORİ VE KANALLAR)
app.get(['/', '/get.php', '/player_api.php'], async (req, res) => {
    const { action, category_id } = req.query;
    try {
        const response = await axios.get(M3U_URL);
        const data = response.data;
        const lines = data.split('\n').filter(l => l.trim() !== "");
        let liveCats = [], liveStreams = [], cMap = new Map(), sIdx = 1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const info = lines[i];
                const sUrl = lines[i + 1] ? lines[i + 1].trim() : "";
                if (!sUrl.startsWith('http')) continue;

                let cName = info.includes('group-title="') ? info.split('group-title="')[1].split('"')[0] : "Genel";
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

        if (action === 'get_live_categories') return res.json(liveCats);
        if (action === 'get_live_streams') {
            let list = (category_id && category_id !== "0") ? liveStreams.filter(s => s.category_id === category_id) : liveStreams;
            return res.json(list);
        }

        return res.json({
            "user_info": { "status": "Active", "exp_date": "1893456000" },
            "server_info": { "url": req.hostname, "port": "80" }
        });
    } catch (e) { res.status(500).send("API Error"); }
});

// 2. YAYIN TÜNELLEME (IPTVNATOR İÇİN ÇÖZÜM)
app.get('/live/:u/:p/:id', async (req, res) => {
    try {
        const streamId = parseInt(req.params.id.split('.')[0]);
        const responseM3U = await axios.get(M3U_URL);
        const streams = responseM3U.data.split('\n').filter(l => l.trim().startsWith('http'));
        const targetUrl = streams[streamId - 1].trim();

        console.log("Proxying stream:", targetUrl);

        // Header'ları IPTVnator'ın seveceği hale getiriyoruz
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', 'video/mp2t'); // TS yayını olduğunu belirtiyoruz

        const streamResponse = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        });

        streamResponse.data.pipe(res);

    } catch (e) {
        console.error("Stream Proxy Error:", e.message);
        res.status(500).send("Stream Error");
    }
});

app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
