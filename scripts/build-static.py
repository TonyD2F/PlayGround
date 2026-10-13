#!/usr/bin/env python3
"""Build dist/index.html static preview from seed data (no DB needed)."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")

STORES = [
    (1, "Capitol Hill \u2014 1401 Broadway", "1401 Broadway, Seattle, WA 98122", 47.6137, -122.3215, 3, 1),
    (2, "Ballard \u2014 7300 15th Ave NW", "7300 15th Ave NW, Seattle, WA 98117", 47.6821, -122.3758, 0, 0),
    (3, "Rainier Beach \u2014 9262 Rainier Ave S", "9262 Rainier Ave S, Seattle, WA 98118", 47.5225, -122.2700, 2, 0),
    (4, "Bellevue Downtown \u2014 300 Bellevue Way NE", "300 Bellevue Way NE, Bellevue, WA 98004", 47.6130, -122.2015, 0, 0),
    (5, "Factoria \u2014 3620 Factoria Blvd SE", "3620 Factoria Blvd SE, Bellevue, WA 98006", 47.5725, -122.1690, 0, 0),
    (6, "Kirkland Totem \u2014 12550 120th Ave NE", "12550 120th Ave NE, Kirkland, WA 98034", 47.7105, -122.1810, 0, 0),
    (7, "Redmond \u2014 17246 Redmond Way", "17246 Redmond Way, Redmond, WA 98052", 47.6705, -122.1220, 0, 0),
    (8, "Renton \u2014 4300 NE 4th St", "4300 NE 4th St, Renton, WA 98056", 47.4835, -122.1800, 0, 0),
    (9, "Kent \u2014 13137 SE Kent Kangley Rd", "13137 SE Kent Kangley Rd, Kent, WA 98042", 47.3765, -122.2020, 0, 0),
    (10, "Federal Way \u2014 33000 Pacific Hwy S", "33000 Pacific Hwy S, Federal Way, WA 98003", 47.3150, -122.3165, 0, 0),
    (11, "Auburn \u2014 101 Auburn Way S", "101 Auburn Way S, Auburn, WA 98002", 47.3050, -122.2280, 0, 0),
    (12, "Issaquah \u2014 735 NW Gilman Blvd", "735 NW Gilman Blvd, Issaquah, WA 98027", 47.5305, -122.0350, 0, 0),
    (13, "Sammamish \u2014 630 228th Ave NE", "630 228th Ave NE, Sammamish, WA 98074", 47.6165, -122.0430, 0, 0),
    (14, "Shoreline \u2014 1530 NE 175th St", "1530 NE 175th St, Shoreline, WA 98155", 47.7585, -122.3120, 0, 0),
    (15, "Burien \u2014 138 SW 148th St", "138 SW 148th St, Burien, WA 98166", 47.4710, -122.3390, 0, 0),
    (16, "Des Moines \u2014 22025 Marine View Dr S", "22025 Marine View Dr S, Des Moines, WA 98198", 47.4020, -122.3260, 0, 0),
    (17, "Woodinville \u2014 17641 Garden Way NE", "17641 Garden Way NE, Woodinville, WA 98072", 47.7540, -122.1550, 0, 0),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def main():
    os.makedirs(DIST, exist_ok=True)
    cards = []
    for sid, name, addr, lat, lng, yes, lp in STORES:
        cls = "store lp" if lp >= 1 else "store"
        badge = ' <span class="badge">LP</span>' if lp >= 1 else ""
        cards.append(
            f'<div class="{cls}" data-id="{sid}" data-lat="{lat}" data-lng="{lng}" data-yes="{yes}" data-lp="{lp}">'
            f"<h3>{esc(name)}{badge}</h3>"
            f'<div class="addr">{esc(addr)}</div>'
            f'<div class="tally">Yes <span class="yv">{yes}</span> \u00b7 No <span class="nv">0</span> \u00b7 LP reports <span class="lpv">{lp}</span></div>'
            f'<div class="row"><button class="yes" data-vote="yes" data-id="{sid}">Yes \u2014 LP here</button>'
            f'<button class="no" data-vote="no" data-id="{sid}">No \u2014 clear</button></div></div>'
        )
    stores_json = json.dumps(
        [{"id": s[0], "name": s[1], "address": s[2], "lat": s[3], "lng": s[4], "yes": s[5], "lp": s[6]} for s in STORES]
    )
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hellfetty.com — King County Safeway LP Map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
:root{--green:#1a7f37;--ink:#111;--line:#d8d8d8;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
header{padding:12px 16px;border-bottom:2px solid var(--ink);display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
header h1{font-size:20px;margin:0}
header .period{font-size:14px;font-weight:600}
main{display:grid;grid-template-columns:1fr 360px;min-height:calc(100vh - 57px)}
#map{min-height:420px;background:#eef2ee}
aside{border-left:2px solid var(--ink);overflow-y:auto;max-height:calc(100vh - 57px)}
.store{padding:10px 12px;border-bottom:1px solid var(--line)}
.store.lp{background:#e9f7ee;border-left:6px solid var(--green)}
.store h3{margin:0 0 2px;font-size:15px}
.store .addr{font-size:13px;color:#222}
.tally{font-size:13px;margin:6px 0;font-variant-numeric:tabular-nums}
.badge{display:inline-block;font-size:12px;font-weight:700;color:#fff;background:var(--green);padding:1px 8px;border-radius:999px;margin-left:6px}
.row{display:flex;gap:8px}
button{flex:1;padding:8px;font-size:14px;font-weight:700;cursor:pointer;border:2px solid var(--ink);background:#fff}
button.yes:hover{background:var(--green);color:#fff;border-color:var(--green)}
button.no:hover{background:var(--ink);color:#fff}
@media(max-width:800px){main{grid-template-columns:1fr}aside{border-left:0;max-height:none}#map{height:50vh;min-height:300px}}
</style>
</head>
<body>
<header><h1>Hellfetty.com</h1><span>King County Safeway LP vote map</span><span class="period" id="period">Period loading\\u2026</span></header>
<main><div id="map" role="application" aria-label="Store map"></div><aside id="list" aria-live="polite">
""" + "\n".join(cards) + """
</aside></main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
window.HF_STORES = """ + stores_json + """;
function hfPeriod(d){try{var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hour12:false,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce(function(a,x){a[x.type]=x.value;return a},{});var h=parseInt(p.hour,10)%24;var md=p.year+'-'+p.month+'-'+p.day;var slot=h>=5&&h<12?1:h>=12&&h<17?2:h>=17&&h<22?3:4;var date=slot===4&&h<5?prevDay(md):md;var labels={1:'Morning 5a-12p',2:'Afternoon 12p-5p',3:'Evening 5p-10p',4:'Overnight 10p-5a'};return{key:date+'-P'+slot,label:labels[slot]}}catch(e){return{key:'live',label:'Live'}}}
function prevDay(md){var d=new Date(md+'T12:00:00');d.setDate(d.getDate()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
(function(){var p=hfPeriod(new Date());document.getElementById('period').textContent='Period '+p.key+' \\u00b7 '+p.label;
try{if(window.L&&document.getElementById('map')){var m=L.map('map').setView([47.548,-122.228],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'\\u00a9 OpenStreetMap'}).addTo(m);window.HF_STORES.forEach(function(s){L.marker([s.lat,s.lng]).addTo(m).bindPopup('<b>'+s.name+'</b><br>Yes '+s.yes+' / No 0')})}}catch(e){}
document.querySelectorAll('button[data-vote]').forEach(function(b){b.addEventListener('click',function(){var card=b.closest('.store');var y=card.querySelector('.yv'),n=card.querySelector('.nv');if(b.dataset.vote==='yes'){y.textContent=parseInt(y.textContent,10)+1;card.classList.add('lp')}else{n.textContent=parseInt(n.textContent,10)+1}})});
})();
</script>
</body>
</html>
"""
    out = os.path.join(DIST, "index.html")
    with open(out, "w") as f:
        f.write(html)
    print(f"wrote {out} ({os.path.getsize(out)} bytes)")


if __name__ == "__main__":
    main()
