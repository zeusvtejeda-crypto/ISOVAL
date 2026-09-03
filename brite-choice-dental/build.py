#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brite Choice Dental — static site generator.
Renders the hub page (index.html) and one page per office (duarte/, el-monte/,
santa-fe-springs/) from the DATA below into plain static HTML. No server,
no build step needed at deploy time — Vercel just serves the output files.

Run:  python3 build.py
Source of truth for facts used below: britechoicedental.com (fetched 2026-09-03),
cross-checked against Google/Yelp/Yahoo Local listings. See
assets/img/CREDITS.md for photo attribution. Site language: English, matching
the real business's primary market (Los Angeles County, CA) and its official
site's default language.
"""
import os, json, html

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_NAME = "Brite Choice Dental"
SITE_URL = "https://brite-choice-dental.vercel.app"
EMAIL = "office@britechoicedental.com"
INSTAGRAM = "https://www.instagram.com/britechoicedental_/"
FACEBOOK = "https://www.facebook.com/BriteChoiceDental/"

# ─────────────────────────── DATA ───────────────────────────

HOURS = [
    ("Sunday", None, None),
    ("Monday", "9:00 AM", "6:00 PM"),
    ("Tuesday", "9:00 AM", "6:00 PM"),
    ("Wednesday", "9:00 AM", "6:00 PM"),
    ("Thursday", "9:00 AM", "6:00 PM"),
    ("Friday", "9:00 AM", "6:00 PM"),
    ("Saturday", "9:00 AM", "2:00 PM"),
]

LOCATIONS = [
    {
        "slug": "duarte",
        "name": "Duarte",
        "city_state": "Duarte, CA",
        "addr1": "2233 Huntington Dr.",
        "addr2": "Duarte, CA 91010",
        "phone_disp": "(833) 952-8989",
        "phone_tel": "+18339528989",
        "lat": 34.1395953, "lng": -117.9574894,
        "areas": ["Duarte", "Monrovia", "Arcadia", "Azusa", "Baldwin Park"],
        "map_q": "2233 Huntington Dr, Duarte, CA 91010",
        "photo": "svc-operatory-bright.jpg",
        "reviews": [
            {"author": "Eisen Salas", "initial": "E",
             "text": "Honestly, I've always been scared of the dentist but the staff makes you feel relaxed and welcomed. Highly recommend. They also have payment plans available."},
            {"author": "Heverlin Angel", "initial": "H",
             "text": "Terri is amazing! Great customer service. Thank you for always smiling. Makes a difference when I'm going in to see the dentist."},
            {"author": "Michael P. Coil", "initial": "M",
             "text": "Amazing office, everyone is super nice and answered all of my questions, they genuinely cared that I was comfortable during my checkins and procedure."},
        ],
    },
    {
        "slug": "el-monte",
        "name": "El Monte",
        "city_state": "El Monte, CA",
        "addr1": "10728 Ramona Blvd. #D",
        "addr2": "El Monte, CA 91731",
        "phone_disp": "(855) 618-0006",
        "phone_tel": "+18556180006",
        "lat": 34.0718950, "lng": -118.0402117,
        "areas": ["El Monte", "South El Monte", "Rosemead", "Temple City", "Baldwin Park"],
        "map_q": "10728 Ramona Blvd D, El Monte, CA 91731",
        "photo": "svc-operatory-cabinets.jpg",
        "reviews": [
            {"author": "Jaumirez", "initial": "J",
             "text": "Genuinely pleased with the dental work I've had so far. The owner really worked with me and is really kind. Jocelyn, the dentist assistant, has been nothing but a sweetheart and always made me feel welcome from day one."},
            {"author": "Monica Cruz", "initial": "M",
             "text": "I had a wonderful experience at Brite Choice Dental on Ramona Boulevard in El Monte. The receptionist was incredibly kind, and the entire staff was welcoming and professional. The office was spotless, and I felt completely at ease."},
            {"author": "Lizbeth Scott", "initial": "L",
             "text": "Great service and very professional dental care. The staff is friendly, and the office is clean and well equipped. Highly recommend."},
        ],
    },
    {
        "slug": "santa-fe-springs",
        "name": "Santa Fe Springs",
        "city_state": "Santa Fe Springs, CA",
        "addr1": "10009 Orr and Day Rd",
        "addr2": "Santa Fe Springs, CA 90670",
        "phone_disp": "(844) 779-1400",
        "phone_tel": "+18447791400",
        "lat": 33.9471030, "lng": -118.0901646,
        "areas": ["Santa Fe Springs", "Whittier", "Norwalk", "Pico Rivera", "Downey"],
        "map_q": "10009 Orr and Day Rd, Santa Fe Springs, CA 90670",
        "photo": "svc-family-pediatric.jpg",
        "reviews": [
            {"author": "Jacqueline Herrera", "initial": "J",
             "text": "The place is clean and the people who helped you are really nice. The doctor speaks Spanish, which is great!"},
            {"author": "Stephanie H.", "initial": "S",
             "text": "I'm a very nervous patient — I had a really bad experience at another dentist. Everyone in the office is so friendly and understanding. The office is clean with a calming atmosphere."},
            {"author": "Sparky H.", "initial": "S",
             "text": "My whole family have been with this practice for 15-plus years. They are efficient and friendly. We highly recommend them to friends and family."},
        ],
    },
]

SERVICES = [
    {"key": "general", "name": "General Dentistry", "icon": "tooth",
     "img": "svc-operatory-bright.jpg",
     "desc": "Exams, cleanings, x-rays and preventive care for the whole family.",
     "tags": ["Cleanings", "X-Rays", "Fillings", "Root Canals"]},
    {"key": "cosmetic", "name": "Cosmetic Dentistry", "icon": "star",
     "img": "detail-tools-tray.jpg",
     "desc": "Whitening, porcelain veneers and smile design built around you.",
     "tags": ["Whitening", "Veneers", "Bonding"]},
    {"key": "surgery", "name": "Oral Surgery & Implants", "icon": "shield",
     "img": "svc-oral-surgery.jpg",
     "desc": "Extractions, wisdom teeth, bone grafting and permanent implants.",
     "tags": ["Implants", "Extractions", "Bone Grafting"]},
    {"key": "restorative", "name": "Restorative Dentistry", "icon": "crown",
     "img": "svc-implants-model.jpg",
     "desc": "Crowns, bridges and dentures that restore function and confidence.",
     "tags": ["Crowns", "Bridges", "Dentures"]},
    {"key": "ortho", "name": "Orthodontic Care", "icon": "align",
     "img": "svc-consultation.jpg",
     "desc": "Traditional and clear options to straighten your smile — we'll help you choose what fits.",
     "tags": ["Braces", "Alignment", "Bite"]},
    {"key": "emergency", "name": "Emergency Dental Care", "icon": "clock",
     "img": "svc-family-pediatric.jpg",
     "desc": "Same-day appointments for pain, swelling or dental trauma.",
     "tags": ["Same-Day", "Pain", "Trauma"]},
]

SPECIALS = [
    {"badge": "New Patients", "name": "Exam + X-Rays", "price": "$49", "note": None},
    {"badge": "Most Popular", "name": "Full Dental Cleaning", "price": "$179", "note": "Regular price $299"},
    {"badge": "Limited Time", "name": "Teeth Whitening", "price": "$380", "note": "Regular price $450"},
    {"badge": "Big Savings", "name": "Implant Special", "price": "Up to $1,500 OFF", "note": "Exact amount determined at evaluation"},
    {"badge": "Families", "name": "Family Discount", "price": "15% OFF", "note": "3+ members of the same family"},
    {"badge": "Seniors", "name": "Senior Discount", "price": "10% OFF", "note": "Age 65+, valid ID required"},
]

WHY = [
    {"icon": "clock", "title": "Same-Day Appointments", "text": "Emergencies and urgent cases seen quickly."},
    {"icon": "card", "title": "0% Interest Financing", "text": "Flexible plans so cost is never the barrier."},
    {"icon": "shield", "title": "We Accept Medicare & Denti-Cal", "text": "Plus most major PPO insurance plans."},
    {"icon": "check", "title": "Open Saturdays", "text": "Care that fits your schedule, not just 9-to-5."},
]

INSURANCE = ["Medicare", "Denti-Cal", "Aetna", "Anthem Blue Cross", "Cigna", "Delta Dental", "Guardian", "MetLife", "United Health Care", "0% Financing"]

FAQ = [
    ("Do you accept walk-ins?", "Yes — walk-ins are welcome. If you have a dental emergency or free time today, stop by any of our three offices and we'll do our best to see you right away."),
    ("What insurance do you accept?", "We accept Medicare, Denti-Cal and most major PPO plans, including Aetna, Ameritas, Anthem Blue Cross, Cigna, Delta Dental, Guardian, MetLife and United Health Care. Not sure about your coverage? Call your nearest office and we'll verify it with you."),
    ("Do you offer payment plans or financing?", "Yes, we offer flexible financing starting at 0% interest so cost is never a barrier to your treatment."),
    ("Can I get an emergency appointment for tooth pain?", "Yes. We reserve same-day slots for emergencies — pain, swelling or trauma — at all three of our locations."),
    ("Do you speak Spanish?", "Yes, we have bilingual staff at our offices ready to help you in Spanish."),
    ("What are your hours?", "Monday through Friday from 9:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 2:00 PM at all three locations. Closed Sundays."),
]

# ─────────────────────────── ICONS ───────────────────────────

ICONS = {
    "tooth": '<path d="M12 3.4c-1.5 0-2.6.9-3.7.9-1.7 0-3.4-1.5-5-.6C1.7 4.6 1 6 1 7.7c0 2 .8 4.1 1.5 6.4.6 2 1.1 4.5 2.1 6.3.6 1.1 1.4 1.7 2.2 1.7 1.1 0 1.4-1.5 1.7-3 .3-1.4.6-3.1 1.5-3.1s1.2 1.7 1.5 3.1c.3 1.5.6 3 1.7 3 .8 0 1.6-.6 2.2-1.7 1-1.8 1.5-4.3 2.1-6.3.7-2.3 1.5-4.4 1.5-6.4 0-1.7-.7-3.1-2.3-4-1.6-.9-3.3.6-5 .6-1.1 0-2.2-.9-3.7-.9z"/>',
    "star": '<path d="M12 2.5l2.9 6.1 6.6.6-5 4.4 1.5 6.5L12 16.8 6 20.1l1.5-6.5-5-4.4 6.6-.6z"/>',
    "shield": '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
    "crown": '<path d="M4 18h16l-1.4-8.5L14 13l-2-7-2 7-4.6-3.5L4 18z"/><path d="M4 20.5h16"/>',
    "align": '<path d="M4 10a8 8 0 0016 0"/><path d="M4 10a8 8 0 0116-0" opacity=".4"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    "check": '<path d="M9 12.5l2 2 4-4"/><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
    "card": '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/>',
    "pin": '<path d="M12 21s-7-6.5-7-11a7 7 0 1114 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    "phone": '<path d="M6.6 10.2c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1v3.4c0 .6-.4 1-1 1C10.5 20.4 3.6 13.5 3.6 4.6c0-.6.4-1 1-1H8c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1z"/>',
    "chevdown": '<path d="M6 9l6 6 6-6"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6z"/>',
    "mail": '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/>',
    "insta": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1"/>',
    "fb": '<path d="M14 21v-8h3l.5-3.5H14V7.2c0-1 .3-1.7 1.8-1.7H18V2.3C17.6 2.2 16.4 2 15 2c-3 0-5 1.8-5 5.2v2.3H7V13h3v8z"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z"/>',
    "users": '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.4 4.7 2.6 4.7 5.8"/>',
    "smile": '<circle cx="12" cy="12" r="9"/><path d="M8 13.5c1 1.3 2.4 2 4 2s3-.7 4-2"/><circle cx="9" cy="9.5" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r=".9" fill="currentColor" stroke="none"/>',
}

def icon(name, cls="icon"):
    return '<svg class="%s" viewBox="0 0 24 24">%s</svg>' % (cls, ICONS[name])

def stars(cls="icon"):
    return "".join(icon("star", cls) for _ in range(5))

def e(s):
    return html.escape(s, quote=True)

# ─────────────────────────── COMPONENTS ───────────────────────────

def nav_links(prefix):
    return [
        (prefix + "#services", "Services"),
        (prefix + "#why", "Why Us"),
        (prefix + "#specials", "Specials"),
        (prefix + "#reviews", "Reviews"),
        (prefix + "#contact", "Contact"),
    ]

def header(active_slug, prefix, home_href):
    switcher_items = "".join(
        '<a href="/%s/" class="%s"><img src="/assets/img/%s" alt=""><span><b>%s</b><small>%s</small></span></a>' % (
            l["slug"], "is-current" if l["slug"] == active_slug else "", l["photo"], l["name"], l["addr2"]
        ) for l in LOCATIONS
    )
    mm_locs = "".join(
        '<a href="/%s/" class="%s"><b>%s</b><small>%s · %s</small></a>' % (
            l["slug"], "is-current" if l["slug"] == active_slug else "", l["name"], l["addr1"], l["phone_disp"]
        ) for l in LOCATIONS
    )
    links = "".join('<a href="%s">%s</a>' % (h, t) for h, t in nav_links(prefix))
    hub_link = '<a href="/" style="color:var(--blue);font-weight:800;">View All 3 Locations →</a>'
    return """
<a href="#main" class="skip">Skip to content</a>
<header class="hdr">
  <div class="hdr-progress"></div>
  <div class="nav-wrap">
    <a href="/" class="logo"><img src="/assets/img/logo.webp" alt="%(site)s" class="logo-img"></a>
    <nav class="links">%(links)s</nav>
    <div class="nav-right">
      <div class="locsw" data-open="false">
        <button class="locsw-btn" type="button">%(pin)s<span>%(loclabel)s</span>%(chev)s</button>
        <div class="locsw-menu">%(switcher)s<a href="/" style="justify-content:center;font-weight:800;color:var(--blue);">View All 3 Locations</a></div>
      </div>
      <a href="tel:%(homephone)s" class="nav-phone">%(phone)sCall</a>
      <a href="%(prefix)s#appointment" class="btn btn-primary nav-book">Book Appointment</a>
      <button class="hamburger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="mobile-menu">
    <div>
      <ul>%(mlinks)s<li style="border:0;padding-top:4px;">%(hublink)s</li></ul>
      <div class="mm-locs">%(mmlocs)s</div>
    </div>
  </div>
</header>
""" % {
        "prefix": prefix, "site": e(SITE_NAME), "links": links,
        "pin": icon("pin"), "loclabel": (active_slug and [l["name"] for l in LOCATIONS if l["slug"] == active_slug][0]) or "Our Locations",
        "chev": icon("chevdown", "icon chev"), "switcher": switcher_items,
        "homephone": (active_slug and [l["phone_tel"] for l in LOCATIONS if l["slug"] == active_slug][0]) or LOCATIONS[0]["phone_tel"],
        "phone": icon("phone"),
        "mlinks": "".join('<li><a href="%s">%s</a></li>' % (h, t) for h, t in nav_links(prefix)),
        "hublink": hub_link, "mmlocs": mm_locs,
    }

def footer(prefix):
    loc_items = "".join(
        '<li><strong>%s</strong><br>%s<br>%s<br><a href="tel:%s">%s</a></li>' % (
            l["name"], l["addr1"], l["addr2"], l["phone_tel"], l["phone_disp"]
        ) for l in LOCATIONS
    )
    svc_items = "".join('<li><a href="%s#services">%s</a></li>' % (prefix, s["name"]) for s in SERVICES)
    return """
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo"><img src="/assets/img/logo.webp" alt="%(site)s" class="logo-img"></div>
        <p>Modern dentistry. Personalized care. Three locations across the San Gabriel Valley, California.</p>
        <div class="social-row">
          <a href="%(insta)s" target="_blank" rel="noopener" aria-label="Instagram">%(iicon)s</a>
          <a href="%(fb)s" target="_blank" rel="noopener" aria-label="Facebook">%(ficon)s</a>
        </div>
      </div>
      <div><h4>Explore</h4><ul>
        <li><a href="%(prefix)s#services">Services</a></li>
        <li><a href="%(prefix)s#why">Why Us</a></li>
        <li><a href="%(prefix)s#specials">Specials</a></li>
        <li><a href="%(prefix)s#reviews">Reviews</a></li>
        <li><a href="%(prefix)s#contact">Contact</a></li>
      </ul></div>
      <div><h4>Services</h4><ul>%(svc)s</ul></div>
      <div><h4>Locations</h4><ul>%(loc)s
        <li><a href="mailto:%(email)s">%(email)s</a></li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> %(site)s. All rights reserved.</span>
      <span class="links"><a href="/privacy.html">Privacy Notice</a></span>
    </div>
  </div>
</footer>
""" % {
        "prefix": prefix, "site": e(SITE_NAME), "insta": INSTAGRAM, "fb": FACEBOOK,
        "iicon": icon("insta"), "ficon": icon("fb"), "svc": svc_items, "loc": loc_items, "email": EMAIL,
    }

def sticky_cta(prefix, phone_tel):
    return """
<div class="sticky-cta">
  <a href="tel:%s" class="btn btn-outline">%sCall</a>
  <a href="%s#appointment" class="btn btn-primary">Book Appointment</a>
</div>""" % (phone_tel, icon("phone"), prefix)

def nearest_bar():
    return """
<div class="nearest-bar" data-nearest-bar hidden>
  <span class="msg" data-nearest-msg></span>
  <a class="link" data-nearest-link href="#"></a>
</div>"""

def service_card(s, prefix):
    tags = "".join("<span>%s</span>" % e(t) for t in s["tags"])
    return """
<article class="svc" data-reveal="up">
  <div class="svc-media"><img src="/assets/img/%(img)s" alt="%(name)s" loading="lazy">
    <div class="icon-badge">%(icon)s</div>
  </div>
  <div class="svc-body">
    <h3>%(name)s</h3>
    <p>%(desc)s</p>
    <div class="svc-tags">%(tags)s</div>
    <a href="%(prefix)s#appointment" class="link">Book a consult %(arrow)s</a>
  </div>
</article>""" % {"prefix": prefix, "img": s["img"], "name": e(s["name"]), "icon": icon(s["icon"]),
                   "desc": e(s["desc"]), "tags": tags, "arrow": icon("arrow", "icon")}

def review_card(r):
    return """
<div class="review-card">
  <div class="stars">%s</div>
  <p>&ldquo;%s&rdquo;</p>
  <div class="reviewer"><div class="avatar">%s</div><div><b>%s</b><small>Google Review</small></div></div>
</div>""" % (stars(), e(r["text"]), e(r["initial"]), e(r["author"]))

def offer_card(o):
    note = '<p>%s</p>' % e(o["note"]) if o["note"] else ""
    return """
<div class="offer-card" data-reveal="up">
  <span class="offer-ribbon">%s</span>
  <h3>%s</h3>
  <div class="offer-price">%s</div>
  %s
  <a href="#appointment" class="btn btn-outline-white btn-block">Claim Offer</a>
</div>""" % (e(o["badge"]), e(o["name"]), e(o["price"]), note)

def why_item(w):
    return """
<div class="why-item">
  <div class="icon-badge">%s</div>
  <div><h4>%s</h4><p>%s</p></div>
</div>""" % (icon(w["icon"]), e(w["title"]), e(w["text"]))

def faq_item(q, a):
    return """
<details>
  <summary>%s %s</summary>
  <div class="faq-a">%s</div>
</details>""" % (e(q), icon("plus"), e(a))

def hours_table():
    rows = []
    for i, (day, o, c) in enumerate(HOURS):
        if o:
            rows.append('<tr data-day="%d"><td>%s</td><td>%s – %s</td></tr>' % (i, day, o, c))
        else:
            rows.append('<tr data-day="%d" class="closed"><td>%s</td><td>Closed</td></tr>' % (i, day))
    return '<table class="hours-table" data-hours-table><tbody>%s</tbody></table>' % "".join(rows)

def map_embed(query, title):
    src = "https://www.google.com/maps?q=%s&output=embed" % query.replace(" ", "+").replace(",", "%2C").replace("#", "%23")
    return '<iframe src="%s" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map to %s"></iframe>' % (src, e(title))

def appointment_form(location_name, phone_tel, phone_disp, prefix):
    loc_field = ""
    if location_name:
        loc_field = '<input type="hidden" name="office" value="%s">' % e(location_name)
    else:
        opts = "".join('<option>%s</option>' % e(l["name"]) for l in LOCATIONS)
        loc_field = """
<div><label for="f-office">Nearest Office</label>
<select id="f-office" name="office">%s</select></div>""" % opts
    return """
<form class="form-card" id="appt-form" data-office-email="%(email)s" data-location="%(loc)s">
  <div class="form-row two">
    <div><label for="f-name">Full Name</label><input id="f-name" type="text" placeholder="Jane Doe" required></div>
    <div><label for="f-phone">Phone Number</label><input id="f-phone" type="tel" placeholder="(562) 000-0000" required></div>
  </div>
  <div class="form-row two">
    <div>
      <label for="f-service">Service</label>
      <select id="f-service">
        <option>General Dentistry</option><option>Cosmetic Dentistry</option>
        <option>Oral Surgery / Implants</option><option>Restorative Dentistry</option>
        <option>Orthodontic Care</option><option>Emergency / Pain</option><option>Not Sure</option>
      </select>
    </div>
    <div><label for="f-day">Preferred Day</label><input id="f-day" type="date"></div>
  </div>
  %(locfield)s
  <button type="submit" class="btn btn-primary btn-block">Request Appointment</button>
  <p class="form-note">*This is a request form — we'll call to confirm. Prefer to talk now? <a href="tel:%(tel)s">Call %(disp)s</a>.</p>
  <div class="form-success">
    <div class="icon-badge" style="margin:0 auto;">%(check)s</div>
    <h3>Request Sent!</h3>
    <p>Your email app opened with your details ready to send. Our team will contact you to confirm your appointment.</p>
  </div>
</form>""" % {"email": EMAIL, "loc": e(location_name or ""), "locfield": loc_field,
              "tel": phone_tel, "disp": phone_disp, "check": icon("check")}

def js_data(active_slug):
    locs = [{"slug": l["slug"], "name": l["name"], "lat": l["lat"], "lng": l["lng"]} for l in LOCATIONS]
    return "window.__BCD__ = %s;" % json.dumps({"slug": active_slug, "locations": locs})

def head(title, desc, canonical, prefix, jsonld):
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:type" content="website">
<meta property="og:image" content="%(site_url)s/assets/img/hero-family-office.webp">
<meta name="theme-color" content="#0A1E42">
<link rel="icon" href="/assets/img/logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script type="application/ld+json">%(jsonld)s</script>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F6FED"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>
    <symbol id="icon-tooth" viewBox="0 0 24 24">%(tooth)s</symbol>
  </defs>
</svg>
""" % {"title": e(title), "desc": e(desc), "canonical": canonical, "prefix": prefix,
       "site_url": SITE_URL, "jsonld": jsonld, "tooth": ICONS["tooth"]}

def tail(active_slug, prefix):
    return """
<script>%s</script>
<script src="/assets/js/site.js"></script>
</body>
</html>""" % js_data(active_slug)

# ─────────────────────────── PAGE: HUB ───────────────────────────

def build_hub():
    prefix = ""
    loc_cards = ""
    for l in LOCATIONS:
        areas = ", ".join(l["areas"][1:4])
        loc_cards += """
<article class="loc-card" data-slug="%(slug)s" data-reveal="up">
  <div class="loc-media">
    <img src="/assets/img/%(photo)s" alt="%(name)s dental office" loading="lazy">
    <span class="loc-status" data-open-badge><span data-open-label>Checking hours…</span></span>
    <span class="loc-dist" data-dist></span>
    <div class="loc-title"><h3>%(name)s</h3><small>San Gabriel Valley, CA</small></div>
  </div>
  <div class="loc-body">
    <div class="loc-address">%(pin)s<span>%(addr1)s<br>%(addr2)s</span></div>
    <div class="loc-hours">%(clock)s<span>Mon–Fri 9–6 · Sat 9–2</span></div>
    <p style="font-size:.85rem;margin:-2px 0 0;">Serving %(areas)s and nearby areas.</p>
    <div class="loc-ctas">
      <a href="/%(slug)s/" class="btn btn-primary">View %(name)s Office</a>
      <a href="tel:%(tel)s" class="btn btn-outline">%(phone)sCall</a>
      <a href="https://maps.google.com/?q=%(mapq)s" target="_blank" rel="noopener" class="btn btn-ghost">%(compass)sDirections</a>
    </div>
  </div>
</article>""" % {
            "slug": l["slug"], "name": e(l["name"]), "photo": l["photo"], "pin": icon("pin"),
            "addr1": e(l["addr1"]), "addr2": e(l["addr2"]), "clock": icon("clock"),
            "areas": e(areas), "tel": l["phone_tel"], "phone": icon("phone"),
            "mapq": l["map_q"].replace(" ", "%20").replace("#", "%23"), "compass": icon("compass"),
        }

    all_reviews = [r for l in LOCATIONS for r in l["reviews"]][:6]
    reviews_html = "".join(review_card(r) for r in all_reviews[:3])

    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "Dentist", "name": SITE_NAME,
        "url": SITE_URL, "telephone": LOCATIONS[0]["phone_tel"],
        "areaServed": [l["city_state"] for l in LOCATIONS],
    })

    body = head(
        "%s — Top Rated Dentist in Duarte, El Monte & Santa Fe Springs, CA" % SITE_NAME,
        "Cosmetic dentistry, implants, orthodontics and family dental care. Walk-ins welcome, Medicare/Denti-Cal accepted, same-day appointments. Three locations across the San Gabriel Valley.",
        SITE_URL + "/", prefix, jsonld,
    )
    body += header(None, prefix, "/")
    body += '<main id="main">'

    # HERO
    body += """
<section class="hero">
  <div class="hero-orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>
  <svg class="hero-tooth-bg"><use href="#icon-tooth"/></svg>
  <div class="container hero-grid">
    <div>
      <div class="badges">
        <span class="badge dot">Walk-Ins Welcome</span>
        <span class="badge dot">Medicare &amp; Denti-Cal</span>
      </div>
      <h1><span class="line"><span>Your Trusted Dentist</span></span><span class="line"><span>Is <span class="grad-text">Near You.</span></span></span></h1>
      <p class="lead">Comprehensive dental care in Duarte, El Monte and Santa Fe Springs — general, cosmetic, oral surgery and implants, all from a team committed to your comfort.</p>
      <div class="hero-ctas">
        <a href="#locations" class="btn btn-primary">%(pin)sFind My Location</a>
        <a href="#appointment" class="btn btn-outline">Book Appointment</a>
      </div>
      <div class="hero-meta">
        <span>%(clock)sMon–Fri 9–6 · Sat 9–2</span>
        <span>%(users)s3 locations across the San Gabriel Valley</span>
      </div>
    </div>
    <div class="hero-visual">
      <div class="hero-photo-wrap">
        <img class="hero-photo" src="/assets/img/hero-family-office.webp" alt="Family smiling in the Brite Choice Dental waiting room">
        <div class="ring"></div>
      </div>
      <span class="hero-caption">%(smile)sDental care for the whole family</span>
      <div class="float-card fc-rating">%(star)s<div><b>5-Star Care</b><small>Verified patient reviews</small></div></div>
      <div class="float-card fc-open" data-open-badge><span class="dotp"></span><div><b data-open-label>Checking hours…</b><small>Pacific Time</small></div></div>
    </div>
  </div>
</section>
<div class="infobar container">
  <div class="tiles">
    <div class="tile"><div class="icon-badge">%(check)s</div><div><b>Walk-Ins</b><span>Welcome at all 3 locations</span></div></div>
    <div class="tile"><div class="icon-badge">%(card)s</div><div><b>Insurance</b><span>Medicare, Denti-Cal &amp; PPO</span></div></div>
    <div class="tile"><div class="icon-badge">%(clock2)s</div><div><b>Emergencies</b><span>Same-day appointments</span></div></div>
    <div class="tile"><div class="icon-badge">%(globe)s</div><div><b>Bilingual</b><span>Se habla español</span></div></div>
  </div>
</div>
<div class="marquee">
  <div class="container"><ul class="marquee-track">%(marquee)s%(marquee)s</ul></div>
</div>
""" % {
        "pin": icon("pin"), "clock": icon("clock"), "users": icon("users"), "smile": icon("smile"),
        "star": icon("star", "icon"), "check": icon("check"), "card": icon("card"),
        "clock2": icon("clock"), "globe": icon("globe"),
        "marquee": "".join('<li>%s%s</li>' % (icon("check"), e(t)) for t in
                            ["Walk-Ins Welcome", "Medicare &amp; Denti-Cal", "0% Financing", "Same-Day Appointments", "Se Habla Español", "Open Saturdays"]),
    }

    # LOCATIONS
    body += """
<section id="locations" class="section section-alt">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Visit Us</div><h2>3 Convenient Locations</h2>
      <p>Same hours at every office — Mon–Fri 9:00 AM–6:00 PM · Sat 9:00 AM–2:00 PM · Closed Sunday.</p></div>
    %(nearest)s
    <div class="loc-grid">%(cards)s</div>
  </div>
</section>""" % {"nearest": nearest_bar(), "cards": loc_cards}

    # SERVICES
    body += """
<section id="services" class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">What We Offer</div><h2>Comprehensive Dental Care</h2><p>Six specialties, one trusted team — at all three of our offices.</p></div>
    <div class="svc-grid">%s</div>
  </div>
</section>""" % "".join(service_card(s, prefix) for s in SERVICES)

    # WHY
    body += """
<section id="why" class="section section-alt">
  <div class="container split">
    <div class="photo-stack">
      <img class="photo" src="/assets/img/hero-operatory-empty.webp" alt="Bright, modern dental treatment room">
      <img class="photo photo-2" src="/assets/img/gallery-child-checkup.jpg" alt="Dental checkup for a young patient">
    </div>
    <div>
      <div class="eyebrow">Why Choose Us</div>
      <h2 style="margin-bottom:8px;">Why Patients Trust %(site)s</h2>
      <p style="max-width:480px;">Compassion, comfort and clear communication — that's how we work at every one of our three offices.</p>
      <div class="why-list">%(why)s</div>
      <div class="stats">
        <div class="stat"><b>10<sup>+</sup></b><span>Years of experience</span></div>
        <div class="stat"><b>3</b><span>Locations in LA County</span></div>
        <div class="stat"><b>0%%</b><span>Financing available</span></div>
        <div class="stat"><b>7</b><span>Days to see you this week*</span></div>
      </div>
      <p style="font-size:.74rem;margin-top:8px;">*Subject to availability; emergencies seen same-day.</p>
    </div>
  </div>
</section>""" % {"site": e(SITE_NAME), "why": "".join(why_item(w) for w in WHY)}

    # BEFORE/AFTER
    body += """
<section class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Transformations</div><h2>Real Patients. Real Smiles.</h2></div>
    <div class="ba-wrap" style="--p:50%%;">
      <div class="ba-layer ba-after"><img src="/assets/img/svc-family-pediatric.jpg" alt="Smile after treatment"><span class="ba-tag">AFTER</span></div>
      <div class="ba-layer ba-before"><img src="/assets/img/svc-family-pediatric.jpg" alt="Before treatment"><span class="ba-tag">BEFORE</span></div>
      <div class="ba-handle"></div>
      <input type="range" min="0" max="100" value="50" class="ba-range" oninput="this.closest('.ba-wrap').style.setProperty('--p', this.value+'%%')" aria-label="Drag to compare before and after">
    </div>
    <p class="ba-caption">Whitening · Veneers · Implants · Orthodontics. Illustrative image — individual results may vary.</p>
  </div>
</section>"""

    # SPECIALS
    body += """
<section id="specials" class="section section-alt">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Limited-Time Offers</div><h2>New Patient Specials</h2></div>
    <div class="grid-specials">%(offers)s</div>
    <p class="specials-note">Offers valid for new patients only. Cannot be combined with insurance or other promotions. Call your office for full details.</p>
  </div>
</section>""" % {"offers": "".join(offer_card(o) for o in SPECIALS)}

    # REVIEWS
    body += """
<section id="reviews" class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Google Reviews</div><h2>Our Patients Recommend Us</h2></div>
    <div class="rating-block"><div class="stars">%(stars)s</div><p>Verified reviews across our three locations</p></div>
    <div class="grid-reviews">%(reviews)s</div>
  </div>
</section>""" % {"stars": stars(), "reviews": reviews_html}

    # TEAM
    body += """
<section class="section section-alt">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Your Care Team</div><h2>A Compassionate Team, Every Visit</h2></div>
    <div class="grid-team">
      <div class="team-card"><div class="team-photo"><img src="/assets/img/team-dentist-portrait.jpg" alt="Brite Choice Dental dentist" loading="lazy"></div>
        <div class="team-body"><h3>General &amp; Cosmetic Dentistry</h3><p>Exams, cleanings and smile design.</p></div></div>
      <div class="team-card"><div class="team-avatar">%(shield)s</div>
        <div class="team-body"><h3>Oral Surgery &amp; Implants</h3><p>Extractions, grafting and implants.</p></div></div>
      <div class="team-card"><div class="team-avatar">%(globe)s</div>
        <div class="team-body"><h3>Patient Coordination</h3><p>Bilingual support (English/Spanish).</p></div></div>
    </div>
  </div>
</section>""" % {"shield": icon("shield"), "globe": icon("globe")}

    # INSURANCE
    body += """
<section class="section">
  <div class="container insurance-grid">
    <div>
      <div class="eyebrow">Coverage &amp; Financing</div>
      <h2 style="margin-bottom:14px;">Insurance &amp; Payment Plans</h2>
      <p style="max-width:440px;margin-bottom:22px;">We accept Medicare, Denti-Cal and most PPO insurance plans, plus flexible financing starting at 0%% interest — so a healthy smile is never out of reach.</p>
      <a href="#appointment" class="btn btn-primary">Check My Coverage</a>
    </div>
    <div class="logo-row">%s</div>
  </div>
</section>""" % "".join('<div class="logo-box">%s</div>' % e(i) for i in INSURANCE)

    # EMERGENCY
    body += """
<section class="emergency">
  <div class="container">
    <span class="badge dot">Dental Emergency?</span>
    <h2>Tooth Pain? We Can See You Today.</h2>
    <p>Same-day emergency appointments available at all three offices — don't wait in pain.</p>
    <div class="hero-ctas">%s</div>
  </div>
</section>""" % "".join('<a href="tel:%s" class="btn btn-white">%sCall %s</a>' % (l["phone_tel"], icon("phone"), e(l["name"])) for l in LOCATIONS)

    # FAQ
    body += """
<section class="section">
  <div class="container container-narrow">
    <div class="section-head"><div class="eyebrow">Frequently Asked Questions</div><h2>Your Questions, Answered</h2></div>
    <div class="faq">%s</div>
  </div>
</section>""" % "".join(faq_item(q, a) for q, a in FAQ)

    # APPOINTMENT
    body += """
<section id="appointment" class="section appointment">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Book Your Visit</div><h2>Request an Appointment</h2><p>Choose your preferred office and we'll call to confirm.</p></div>
    %s
  </div>
</section>""" % appointment_form(None, LOCATIONS[0]["phone_tel"], LOCATIONS[0]["phone_disp"], prefix)

    body += "</main>"
    body += footer(prefix)
    body += sticky_cta(prefix, LOCATIONS[0]["phone_tel"])
    body += tail(None, prefix)

    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(body)
    print("wrote index.html (%d bytes)" % len(body))

# ─────────────────────────── PAGE: LOCATION ───────────────────────────

def build_location(loc):
    prefix = ""  # location pages have their own #services/#why/... sections — anchors stay same-page
    others = [l for l in LOCATIONS if l["slug"] != loc["slug"]]

    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "Dentist", "name": "%s — %s" % (SITE_NAME, loc["name"]),
        "url": "%s/%s/" % (SITE_URL, loc["slug"]), "telephone": loc["phone_tel"],
        "address": {"@type": "PostalAddress", "streetAddress": loc["addr1"], "addressLocality": loc["name"], "addressRegion": "CA"},
        "geo": {"@type": "GeoCoordinates", "latitude": loc["lat"], "longitude": loc["lng"]},
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "18:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "09:00", "closes": "14:00"},
        ],
    })

    body = head(
        "%s in %s — General, Cosmetic & Implant Dentistry" % (SITE_NAME, loc["city_state"]),
        "Dental office in %s: general dentistry, cosmetic care, oral surgery and implants. Walk-ins welcome, Medicare/Denti-Cal accepted. %s." % (loc["city_state"], loc["addr1"]),
        "%s/%s/" % (SITE_URL, loc["slug"]), prefix, jsonld,
    )
    body += header(loc["slug"], prefix, "/")
    body += '<main id="main">'

    # HERO
    areas_txt = ", ".join(loc["areas"][1:])
    body += """
<section class="hero">
  <div class="hero-orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>
  <svg class="hero-tooth-bg"><use href="#icon-tooth"/></svg>
  <div class="container">
    <div class="crumbs"><a href="/">%(site)s</a>%(chev)s<span aria-current="page">%(name)s</span></div>
  </div>
  <div class="container hero-grid">
    <div>
      <div class="badges">
        <span class="badge dot" data-open-badge><span data-open-label>Checking hours…</span></span>
        <span class="badge dot">Walk-Ins Welcome</span>
      </div>
      <h1><span class="line"><span>Your Dentist in</span></span><span class="line"><span><span class="grad-text">%(name)s</span>, CA.</span></span></h1>
      <p class="lead">General dentistry, cosmetic care, oral surgery and implants — personalized care for you and your family in %(name)s and nearby areas.</p>
      <div class="hero-ctas">
        <a href="tel:%(tel)s" class="btn btn-primary">%(phone)sCall %(disp)s</a>
        <a href="https://maps.google.com/?q=%(mapq)s" target="_blank" rel="noopener" class="btn btn-outline">%(compass)sGet Directions</a>
      </div>
      <div class="hero-meta">
        <span>%(pin)s%(addr1)s, %(addr2)s</span>
        <span>%(clock)sMon–Fri 9–6 · Sat 9–2</span>
      </div>
    </div>
    <div class="hero-visual">
      <div class="hero-photo-wrap">
        <img class="hero-photo" src="/assets/img/%(photo)s" alt="%(name)s dental office of %(site)s">
        <div class="ring"></div>
      </div>
      <span class="hero-caption">%(pin2)s%(addr1)s</span>
      <div class="float-card fc-rating">%(star)s<div><b>5-Star Care</b><small>Verified reviews from %(name)s</small></div></div>
      <div class="float-card fc-open" data-open-badge><span class="dotp"></span><div><b data-open-label>Checking hours…</b><small>Pacific Time</small></div></div>
    </div>
  </div>
</section>
<div class="infobar container">
  <div class="tiles">
    <div class="tile"><div class="icon-badge">%(pin3)s</div><div><b>Address</b><span>%(addr1)s</span><small>%(addr2)s</small></div></div>
    <div class="tile"><div class="icon-badge">%(phone2)s</div><div><b>Phone</b><span data-copy="%(disp)s" style="cursor:pointer;">%(disp)s</span><small>Tap to copy</small></div></div>
    <div class="tile"><div class="icon-badge">%(clock2)s</div><div><b>Hours</b><span>Mon–Fri 9–6</span><small>Sat 9–2 · Closed Sun</small></div></div>
    <div class="tile"><div class="icon-badge">%(compass2)s</div><div><b>Nearby Areas</b><span style="font-size:.8rem;font-weight:600;">%(areas)s</span></div></div>
  </div>
</div>
<div class="marquee"><div class="container"><ul class="marquee-track">%(marquee)s%(marquee)s</ul></div></div>
""" % {
        "site": e(SITE_NAME), "chev": icon("arrow", "icon"), "name": e(loc["name"]),
        "tel": loc["phone_tel"], "disp": e(loc["phone_disp"]), "phone": icon("phone"),
        "mapq": loc["map_q"].replace(" ", "%20").replace("#", "%23"), "compass": icon("compass"),
        "pin": icon("pin"), "addr1": e(loc["addr1"]), "addr2": e(loc["addr2"]), "clock": icon("clock"),
        "photo": loc["photo"], "pin2": icon("pin"), "star": icon("star"),
        "pin3": icon("pin"), "phone2": icon("phone"), "clock2": icon("clock"), "compass2": icon("compass"),
        "areas": e(areas_txt),
        "marquee": "".join('<li>%s%s</li>' % (icon("check"), e(t)) for t in
                            ["Walk-Ins Welcome", "Medicare &amp; Denti-Cal", "0% Financing", "Same-Day Appointments", "Se Habla Español", "Open Saturdays"]),
    }

    # SERVICES
    body += """
<section id="services" class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">What We Offer in %(name)s</div><h2>Comprehensive Dental Care</h2><p>Six specialties, one trusted team.</p></div>
    <div class="svc-grid">%(cards)s</div>
  </div>
</section>""" % {"name": e(loc["name"]), "cards": "".join(service_card(s, prefix) for s in SERVICES)}

    # WHY + gallery
    body += """
<section id="why" class="section section-alt">
  <div class="container split">
    <div class="photo-stack">
      <img class="photo" src="/assets/img/%(photo)s" alt="Inside our %(name)s office">
      <img class="photo photo-2" src="/assets/img/detail-tools-tray.jpg" alt="Sterilized dental instruments">
    </div>
    <div>
      <div class="eyebrow">Why Choose Us</div>
      <h2 style="margin-bottom:8px;">Why Patients Trust Us in %(name)s</h2>
      <p style="max-width:480px;">Compassion, comfort and clear communication — that's how we work with you at every visit.</p>
      <div class="why-list">%(why)s</div>
    </div>
  </div>
</section>""" % {"name": e(loc["name"]), "photo": loc["photo"], "why": "".join(why_item(w) for w in WHY)}

    # GALLERY
    gallery_imgs = [
        ("/assets/img/%s" % loc["photo"], "Treatment room — %s" % loc["name"], "wide"),
        ("/assets/img/gallery-child-checkup.jpg", "Family dentistry", ""),
        ("/assets/img/svc-oral-surgery.jpg", "Advanced technology &amp; care", "tall"),
        ("/assets/img/svc-implants-model.jpg", "Dental implants", ""),
        ("/assets/img/svc-consultation.jpg", "Consultation &amp; treatment planning", ""),
        ("/assets/img/detail-tools-tray.jpg", "Sterilized instruments", ""),
    ]
    gitems = "".join(
        '<a href="%s" class="%s" data-lightbox data-caption="%s"><img src="%s" alt="%s" loading="lazy"><span>%s</span></a>' % (
            src, cls, e(cap), src, e(cap), cap
        ) for src, cap, cls in gallery_imgs
    )
    body += """
<section class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">See Our Space</div><h2>A Modern, Comfortable Office</h2></div>
    <div class="gallery">%s</div>
  </div>
</section>""" % gitems

    # SPECIALS
    body += """
<section id="specials" class="section section-alt">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Offers in %(name)s</div><h2>New Patient Specials</h2></div>
    <div class="grid-specials">%(offers)s</div>
    <p class="specials-note">Offers valid for new patients only at this office. Cannot be combined with insurance or other promotions.</p>
  </div>
</section>""" % {"name": e(loc["name"]), "offers": "".join(offer_card(o) for o in SPECIALS)}

    # REVIEWS
    body += """
<section id="reviews" class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Google Reviews — %(name)s</div><h2>What Our Patients Say</h2></div>
    <div class="rating-block"><div class="stars">%(stars)s</div><p>Real reviews from %(name)s patients</p></div>
    <div class="grid-reviews">%(reviews)s</div>
  </div>
</section>""" % {"name": e(loc["name"]), "stars": stars(), "reviews": "".join(review_card(r) for r in loc["reviews"])}

    # INSURANCE
    body += """
<section class="section">
  <div class="container insurance-grid">
    <div>
      <div class="eyebrow">Coverage &amp; Financing</div>
      <h2 style="margin-bottom:14px;">Insurance &amp; Payment Plans</h2>
      <p style="max-width:440px;margin-bottom:22px;">At our %(name)s office we accept Medicare, Denti-Cal and most PPO insurance plans, plus flexible financing starting at 0%% interest.</p>
      <a href="#appointment" class="btn btn-primary">Check My Coverage</a>
    </div>
    <div class="logo-row">%(ins)s</div>
  </div>
</section>""" % {"name": e(loc["name"]), "ins": "".join('<div class="logo-box">%s</div>' % e(i) for i in INSURANCE)}

    # EMERGENCY
    body += """
<section class="emergency">
  <div class="container">
    <span class="badge dot">Dental Emergency?</span>
    <h2>Tooth Pain? We Can See You Today.</h2>
    <p>Same-day emergency appointments at our %(name)s office — don't wait in pain.</p>
    <div class="hero-ctas"><a href="tel:%(tel)s" class="btn btn-white">%(phone)sCall Now %(disp)s</a></div>
  </div>
</section>""" % {"name": e(loc["name"]), "tel": loc["phone_tel"], "phone": icon("phone"), "disp": e(loc["phone_disp"])}

    # HOURS + MAP
    body += """
<section id="contact" class="section">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Visit Us</div><h2>Hours &amp; Location — %(name)s</h2></div>
    <div class="hours-grid">
      <div class="hours-card">
        <h3>%(addr1)s</h3>
        <div class="hours-status" data-hours-status>Checking hours…</div>
        %(table)s
        <div class="hours-ctas">
          <a href="tel:%(tel)s" class="btn btn-outline">%(phone)s%(disp)s</a>
          <a href="https://maps.google.com/?q=%(mapq)s" target="_blank" rel="noopener" class="btn btn-primary">%(compass)sGet Directions</a>
        </div>
      </div>
      <div class="map-frame">
        %(map)s
        <div class="map-pin">%(pin)s<div><b>%(name)s</b><small>%(addr1)s, %(addr2)s</small></div></div>
      </div>
    </div>
  </div>
</section>""" % {
        "name": e(loc["name"]), "addr1": e(loc["addr1"]), "table": hours_table(),
        "tel": loc["phone_tel"], "phone": icon("phone"), "disp": e(loc["phone_disp"]),
        "mapq": loc["map_q"].replace(" ", "%20").replace("#", "%23"), "compass": icon("compass"),
        "map": map_embed(loc["map_q"], loc["name"]), "pin": icon("pin"), "addr2": e(loc["addr2"]),
    }

    # OTHER LOCATIONS
    other_cards = "".join("""
<article class="loc-card" data-slug="%(slug)s">
  <div class="loc-media"><img src="/assets/img/%(photo)s" alt="%(name)s dental office" loading="lazy">
    <span class="loc-status" data-open-badge><span data-open-label>Checking hours…</span></span>
    <div class="loc-title"><h3>%(name)s</h3></div></div>
  <div class="loc-body">
    <div class="loc-address">%(pin)s<span>%(addr1)s<br>%(addr2)s</span></div>
    <div class="loc-ctas"><a href="/%(slug)s/" class="btn btn-primary">View %(name)s Office</a><a href="tel:%(tel)s" class="btn btn-outline">%(phone)sCall</a></div>
  </div>
</article>""" % {"slug": o["slug"], "photo": o["photo"], "name": e(o["name"]), "pin": icon("pin"),
                  "addr1": e(o["addr1"]), "addr2": e(o["addr2"]), "tel": o["phone_tel"], "phone": icon("phone")}
        for o in others)
    body += """
<section class="section section-alt">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Other Locations</div><h2>We're Also Nearby</h2><p>Is %(name)s not convenient? Visit us at one of these other locations.</p></div>
    <div class="loc-grid two">%(cards)s</div>
  </div>
</section>""" % {"name": e(loc["name"]), "cards": other_cards}

    # FAQ
    body += """
<section class="section">
  <div class="container container-narrow">
    <div class="section-head"><div class="eyebrow">Frequently Asked Questions</div><h2>Your Questions, Answered</h2></div>
    <div class="faq">%s</div>
  </div>
</section>""" % "".join(faq_item(q, a) for q, a in FAQ)

    # APPOINTMENT
    body += """
<section id="appointment" class="section appointment">
  <div class="container">
    <div class="section-head"><div class="eyebrow">Book Your Visit in %(name)s</div><h2>Request an Appointment</h2><p>Fill out the form and our team will call to confirm your visit.</p></div>
    %(form)s
  </div>
</section>""" % {"name": e(loc["name"]), "form": appointment_form(loc["name"], loc["phone_tel"], loc["phone_disp"], prefix)}

    body += "</main>"
    body += footer(prefix)
    body += sticky_cta(prefix, loc["phone_tel"])
    body += tail(loc["slug"], prefix)

    outdir = os.path.join(ROOT, loc["slug"])
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "index.html"), "w", encoding="utf-8") as f:
        f.write(body)
    print("wrote %s/index.html (%d bytes)" % (loc["slug"], len(body)))

# ─────────────────────────── PAGE: PRIVACY (minimal, real) ───────────────────────────

def build_privacy():
    prefix = "/"
    body = head("Privacy Notice — %s" % SITE_NAME,
                 "How %s collects and uses your contact information." % SITE_NAME,
                 SITE_URL + "/privacy.html", prefix, "{}")
    body += header(None, prefix, "/")
    body += """
<main id="main"><section class="section container-narrow container" style="padding-top:48px;">
<div class="crumbs"><a href="/">%(site)s</a>%(chev)s<span aria-current="page">Privacy</span></div>
<h1 style="margin-bottom:18px;">Privacy Notice</h1>
<p style="margin-bottom:14px;">When you fill out our appointment form, we use your name, phone number and any preferences you provide only to contact you and confirm your visit at %(site)s. We do not sell or share your information with third parties for marketing purposes.</p>
<p style="margin-bottom:14px;">We may contact you by call, email or text message to follow up on your request, based on the contact method you provide.</p>
<p>If you have questions about your data, email us at <a href="mailto:%(email)s" style="color:var(--blue);font-weight:700;">%(email)s</a> or call your nearest office.</p>
</section></main>""" % {"site": e(SITE_NAME), "chev": icon("arrow", "icon"), "email": EMAIL}
    body += footer(prefix)
    body += sticky_cta(prefix, LOCATIONS[0]["phone_tel"])
    body += tail(None, prefix)
    with open(os.path.join(ROOT, "privacy.html"), "w", encoding="utf-8") as f:
        f.write(body)
    print("wrote privacy.html (%d bytes)" % len(body))

# ─────────────────────────── RUN ───────────────────────────

if __name__ == "__main__":
    build_hub()
    for loc in LOCATIONS:
        build_location(loc)
    build_privacy()
    print("done.")
