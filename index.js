const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

// API (Kategoriler ve Kanallar)
app.get(['/', '/get.php', '/player_api.php'], async (req, res) => {
    const { action, category_id } = req.query;
    try {
        const response = await axios.get(M3U_URL);
        const lines = response.data.split('\n').filter(l => l.trim() !== "");
        let cats = [], streams = [], cMap = new Map(), sIdx = 1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const info = lines[i];
                const sUrl = lines[i + 1] ? lines[i + 1].trim() : "";
                if (!sUrl.startsWith('http')) continue;

                let cName = info.includes('group-title="') ? info.split('group-title="')[1].split('"')[0] : "Genel";
                if (!cMap.has(cName)) {
                    let cId = (cMap.size + 1).toString();
                    cMap.set(cName, cId);
                    cats.push({ "category_id": cId, "category_name": cName });
                }
                streams.push({
                    "num": sIdx,
                    "name": info.split(',').pop().trim(),
                    "stream_id": sIdx.toString(),
                    "category_id": cMap.get(cName),
                    "container_extension": sUrl.includes('.m3u8') ? "m3u8" : "ts"
                });
                sIdx++;
            }
        }

        if (action === 'get_live_categories') return res.json(cats);
        if (action === 'get_live_streams') {
            let list = (category_id && category_id !== "0") ? streams.filter(s => s.category_id === category_id) : streams;
            return res.json(list);
        }

        return res.json({
            "user_info": { "status": "Active", "exp_date": "1893456000" },
            "server_info": { "url": req.hostname, "port": "80" }
        });
    } catch (e) { res.status(500).send("API Error"); }
});

// YAYIN AKIŞI (PROXY + REDIRECT HİBRİT)
app.get('/live/:u/:p/:id', async (req, res) => {
    try {
        const streamId = parseInt(req.params.id.split('.')[0]);
        const responseM3U = await axios.get(M3U_URL);
        const streams = responseM3U.data.split('\n').filter(l => l.trim().startsWith('http'));
        const targetUrl = streams[streamId - 1].trim();

        // IPTVnator (Tarayıcı motoru) CORS hatası vermemesi için yönlendirmeden önce header ekliyoruz
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Render üzerinden tünelleme yapmak yerine, 302 yönlendirmesiyle asıl adrese gönderiyoruz
        // Ama yönlendirmeyi "Kalıcı (301)" yaparak cihazın daha hızlı bağlanmasını deniyoruz.
        return res.redirect(301, targetUrl);

    } catch (e) {
        res.status(500).send("Stream Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
