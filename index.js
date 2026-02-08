const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const M3U_URL = "https://github.com/klemen860-cmyk/tvnov/raw/refs/heads/main/yabanci.m3u";

// 1. XTREAM LOGIN & PANEL DATA
app.get(['/', '/get.php', '/player_api.php'], async (req, res) => {
    const { action, type } = req.query;

    // M3U Modu (get.json hatasını kökten çözer)
    if (type === 'm3u_plus' || req.path.includes('get.php')) {
        const response = await axios.get(M3U_URL);
        res.setHeader('Content-Type', 'application/x-mpegurl');
        res.setHeader('Content-Disposition', 'attachment; filename="playlist.m3u"');
        return res.send(response.data);
    }

    // Xtream API Modu
    if (action === 'get_live_categories' || action === 'get_live_streams' || !action) {
        try {
            const response = await axios.get(M3U_URL);
            const data = response.data;
            const lines = data.split('\n').filter(l => l.trim() !== "");
            
            let cats = [], streams = [], cMap = new Map(), sIdx = 1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXTINF:')) {
                    const info = lines[i];
                    const sUrl = lines[i+1];
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
                        "container_extension": "ts"
                    });
                    sIdx++;
                }
            }

            if (action === 'get_live_categories') return res.json(cats);
            if (action === 'get_live_streams') {
                const cId = req.query.category_id;
                let list = (cId && cId !== "0") ? streams.filter(s => s.category_id === cId) : streams;
                return res.json(list);
            }

            // Default Login Response
            return res.json({
                "user_info": { "status": "Active", "exp_date": "1893456000" },
                "server_info": { "url": req.hostname, "port": "80" }
            });

        } catch (e) { res.status(500).send("Error"); }
    }
});

// 2. LIVE STREAM REDIRECT
app.get('/live/:user/:pass/:id', async (req, res) => {
    const streamId = parseInt(req.params.id.split('.')[0]);
    const response = await axios.get(M3U_URL);
    const lines = response.data.split('\n').filter(l => l.trim() !== "");
    
    let currentIdx = 1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF:')) {
            if (currentIdx === streamId) {
                return res.redirect(lines[i+1].trim());
            }
            currentIdx++;
        }
    }
    res.status(404).send("Stream not found");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
