import re, glob, json, os

NAMES={
 'kelvin':'Kelvin SAMAHANI','aurelie':'Aurelie YANSONEYE','patrick':'Patrick ISHIMWE',
 'diane':'Diane UWASE','béatrice':'Beatrice NGEZEKURE','beatrice':'Beatrice NGEZEKURE',
 'faustin':'Faustin','dieudonne':'Dieudonne NIYIDUHABYOSE','jean paul':'Jean Paul NSENGIYUMVA'}
MAP={'MS':'MS','TR':'TR','TRS':'TR','RWB':'RBW','RBW':'RBW','AL*':'AL','AL':'AL','DN':'DN',
     'D':'D','N':'N','OFF':'OFF','ML':'ML','PL':'PL','SL':'SL','CL':'CL','IL':'CL','AA':'AA',
     'H':'H','WD':'WD','ABS':'WD','SICK':'SL','MAT':'ML','-':'BE','BE':'BE'}

def parse(path):
    head=None; rows=[]
    for line in open(path, encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'):
            head=line[1:].strip(); continue
        if not line.strip(): continue
        cells=[c.strip() for c in line.strip().strip('|').split('|')]
        name=cells[0].replace('\\*','').replace('*','').strip()
        codes=[]
        for c in cells[1:]:
            c=c.replace('\\','').strip()
            if c=='': codes.append('')
            else:
                k=MAP.get(c.upper(), c.upper())
                codes.append(k)
        # drop trailing blanks
        while codes and codes[-1]=='': codes.pop()
        rows.append((name, codes))
    m=re.search(r'from=([\d-]+)', head); from_=m.group(1)
    # the sheet's own date row can stop short of the cells the sides actually fill,
    # so the length of the month is the widest row, never a number typed by hand
    days=max(len(c) for _,c in rows)
    m=re.match(r'([^|]+)\|?', head); title=m.group(1).strip()
    return dict(title=title, from_=from_, days=days, rows=rows)

out={}
for p in sorted(glob.glob(os.path.join(os.path.dirname(__file__),'sheets','*.txt'))):
    key=os.path.basename(p).replace('.txt','')
    d=parse(p)
    bad=[(n,len(c)) for n,c in d['rows'] if len(c)>d['days']]
    if bad: raise SystemExit('too many cells in %s: %s'%(key,bad))
    norm=[]
    for n,c in d['rows']:
        key_name=n.lower()
        canon=NAMES.get(key_name, n)
        cc=c+['']*(d['days']-len(c))
        norm.append({'name':canon,'codes':cc})
    out[key]={'source':d['title'],'from':d['from_'],'days':d['days'],'staff':norm}
    print(key, d['from_'], d['days'], [len(s['codes']) for s in norm])

# emit JS
def jsl(rows):
    lines=[]
    for r in rows:
        codes='['+','.join("'"+c+"'" for c in r['codes'])+']'
        lines.append("      {name:'"+r['name']+"', codes:"+codes+'}')
    return ',\n'.join(lines)

js=["/* ============================================================================",
"   HISTORICAL WORKING PLANS — transcribed from the department's own sheets",
"   ----------------------------------------------------------------------------",
"   Every month below was read cell by cell from the department's workbook (Work",
"   plan - Lab.xlsx, sheet by sheet) and is kept here as a record. It is not a",
"   generated plan and it is not a signed one: the console shows it as *Transcribed*",
"   and it is never printed as if the department had published it.",
"",
"   Codes are the ones the paper uses: D day · N night · DN day+night · OFF off duty ·",
"   RBW off duty, rest before work · AL annual leave · ML maternal · PL paternal ·",
"   SL sick · CL circumstantial · AA authorised · H public holiday ·",
"   WD work desertion / unauthorised absence · TR training · MS mentorship.",
"   A row carries one code per day, from `from`, for `days` days; '' is a blank cell.",
"   ========================================================================== */",
"window.LS_PLAN_ARCHIVE = {"]
keys=sorted(out)
for i,k in enumerate(keys):
    e=out[k]
    js.append("  '%s': {"%k)
    js.append("    source:'%s',"%e['source'].replace("'","\\'"))
    js.append("    from:'%s', days:%d,"%(e['from'],e['days']))
    js.append("    staff:[")
    js.append(jsl(e['staff']))
    js.append("    ]")
    js.append("  }"+(',' if i<len(keys)-1 else ''))
js.append("};")
open(os.path.join(os.path.dirname(__file__),'..','assets','data','plan-archive.js'),'w').write('\n'.join(js)+'\n')
print('wrote', len(keys), 'months')
