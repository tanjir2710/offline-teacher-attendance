"""Extract positioned duty cells and electric-green fills from the supplied PDF."""
import fitz,json,re,sys,collections,pathlib
source=sys.argv[1]
out=pathlib.Path(sys.argv[2])
doc=fitz.open(source)
dates=['2026-10-28']*3+['2026-10-29']*2+['2026-10-31']*3+['2026-11-01']*2+['2026-11-02']*3+['2026-11-03']*2+['2026-11-04']*3
teachers=[];duties=[]; group='Full time'; missing=[];anomalies=[];fillcount=collections.Counter()
for pi,page in enumerate(doc):
 words=page.get_text('words'); drawings=page.get_drawings()
 headers=sorted([w for w in words if 118<w[1]<124 and w[0]>395 and w[4] in ['A','B','C']],key=lambda w:w[0])
 assert len(headers)==18,(pi,len(headers))
 centers=[(w[0]+w[2])/2 for w in headers]
 rows=sorted([w for w in words if w[0]<70 and w[4].isdigit() and 130<w[1]<560],key=lambda w:w[1])
 for row in rows:
  cy=(row[1]+row[3])/2
  lines=[w for w in words if abs((w[1]+w[3])/2-cy)<2]
  serial=int(row[4]); before=' '.join(w[4] for w in words if w[1]<row[1])
  if pi==4 or pi==5: group='Contractual'
  if pi==5:
   section=[w for w in words if w[4]=='Part-time']
   other=[w for w in words if w[4]=='Other']
   if section and row[1]>section[0][1]:group='Part time'
   if other and row[1]>other[0][1]:group='Other departments'
  name=' '.join(w[4] for w in sorted(lines,key=lambda w:w[0]) if 70<w[0]<257)
  initial=' '.join(w[4] for w in lines if 258<w[0]<306).strip()
  from_name=re.search(r'\(\s*([A-Za-z]+)\s*\)',name)
  original=initial.lstrip('*') or (from_name[1] if from_name else '')
  alias=original or f"{'FT' if group=='Full time' else 'CT' if group=='Contractual' else 'PT' if group=='Part time' else 'OT'}{serial}"
  tid=alias.lower(); designation=' '.join(w[4] for w in sorted(lines,key=lambda w:w[0]) if 307<w[0]<395)
  if not original:missing.append({'name':name,'username':tid,'page':pi+1})
  t={'id':tid,'name':name.strip(),'initial':original or None,'username':tid,'designation':designation.strip(),'group':group,'externalDuty':initial.startswith('*'),'sourcePage':pi+1,'sourceSerial':serial}
  teachers.append(t)
  for w in lines:
   if w[0]<395 or w[4] not in ['A','B','C']:continue
   x=(w[0]+w[2])/2;y=(w[1]+w[3])/2
   ci=min(range(18),key=lambda i:abs(centers[i]-x))
   mismatch=headers[ci][4]!=w[4]
   if mismatch:anomalies.append({'teacher':name,'date':dates[ci],'columnSlot':headers[ci][4],'printedSlot':w[4],'page':pi+1})
   colors=[d['fill'] for d in drawings if d['fill'] and d['rect'].contains(fitz.Point(x,y))]
   green=any(c[1]>.95 and c[0]<.05 and c[2]<.05 for c in colors)
   fillcount['ANX1' if green else 'KT']+=1
   duties.append({'id':f'{tid}-{dates[ci]}-{headers[ci][4]}','teacherId':tid,'date':dates[ci],'slot':headers[ci][4],'printedSlot':w[4],'needsReview':mismatch,'building':'ANX1' if green else 'KT','sourcePage':pi+1,'sourceColor':'electric-green' if green else 'other'})
assert len(set(t['id'] for t in teachers))==len(teachers),'Duplicate teacher identifier'
assert len(set(d['id'] for d in duties))==len(duties),'Duplicate duty'
result={'term':'Midterm · Fall 2026','department':'Computer Science and Engineering','university':'Daffodil International University','timezone':'Asia/Dhaka','dates':list(dict.fromkeys(dates)),'slots':{'A':{'start':'09:00','end':'10:30'},'B':{'start':'11:30','end':'13:00'},'C':{'start':'14:00','end':'15:30'}},'teachers':teachers,'duties':duties,'importNotes':{'missingInitials':missing,'slotConflicts':anomalies,'roomNote':'Individual examination rooms are not listed. KT-204 is the listed Knowledge Tower Exam Control Room. Confirm the Annex control-room location with the examination committee.','arrivalMinutes':30,'reminderMinutes':40}}
out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'teachers':len(teachers),'duties':len(duties),'buildings':dict(fillcount),'missingInitials':missing,'slotConflicts':anomalies,'TAA':[d for d in duties if d['teacherId']=='taa']},indent=2))
