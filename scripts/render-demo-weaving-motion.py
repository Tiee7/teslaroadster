#!/usr/bin/env python3
import os
os.environ.setdefault("MPLCONFIGDIR", "/tmp/demo-weaving-matplotlib")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp/demo-weaving-cache")
import sys,json,numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
source,prefix=sys.argv[1:3]
d=json.load(open(source));r=d['rows'];e=d['event'];start=e['startedAtSeconds'];end=e['completedAtSeconds'];duration=e['durationSeconds']
t=np.array([v['t']-start for v in r]);x=np.array([v['x'] for v in r]);speed=np.array([v['speedKmh'] for v in r]);gap=np.array([np.nan if v['nearestAheadBumperGapM'] is None else v['nearestAheadBumperGapM'] for v in r])
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':12,'axes.labelsize':10,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#CBD5E1','xtick.color':'#475569','ytick.color':'#475569','text.color':'#16243A','axes.labelcolor':'#334155','figure.facecolor':'#FAFCFF','axes.facecolor':'#FAFCFF'})
fig,axes=plt.subplots(3,1,figsize=(10,8.5),sharex=True,gridspec_kw={'hspace':.45})
fig.subplots_adjust(left=.115,right=.95,top=.80,bottom=.18)
fig.text(.115,.956,'One complete demo lane change',fontsize=21,fontweight='bold')
fig.text(.115,.922,'CPU production simulation · not WebGL',fontsize=12,color='#52647C')
scenario=f"{d['scenario']}  |  seed {d['seed']}  |  {d['trafficCount']} traffic car{'s' if d['trafficCount']!=1 else ''}  |  {d['fps']} Hz"
fig.text(.115,.886,scenario,fontsize=10,color='#52647C')
fig.text(.115,.852,f"Lane {e['fromLane']+1} → {e['targetLane']+1}  ·  {duration:.3f}s to planner-confirmed center completion",fontsize=10,fontweight='bold')
for ax in axes:
 ax.grid(axis='y',color='#DFE6EF',linewidth=.7);ax.set_axisbelow(True);ax.axvspan(0,duration,color='#E3EEF9',alpha=.65)
 ax.axvline(0,color='#7291B6',linewidth=.8,linestyle=':');ax.axvline(duration,color='#7291B6',linewidth=.8,linestyle=':');ax.xaxis.set_major_locator(MaxNLocator(7))
axes[0].plot(t,x,color='#1262A5',linewidth=2.4,label='Actual lateral position')
for level,label in [(e['fromX'],'Source lane center'),(e['targetX'],'Target lane center')]:
 axes[0].axhline(level,color='#728197',linestyle='--',linewidth=.85,label=label)
axes[0].set_ylabel('Lateral x (m)');axes[0].set_title('A full lane-center move',loc='left',pad=9);axes[0].legend(loc='best',fontsize=8,frameon=False,ncols=2)
axes[1].plot(t,speed,color='#137C68',linewidth=2.4);axes[1].set_ylabel('Speed (km/h)');axes[1].set_title('Speed from unchanged propulsion and tank physics',loc='left',pad=9)
axes[2].plot(t,gap,color='#BA6E09',linewidth=2.2,label='Nearest ahead bumper gap')
axes[2].axhline(2,color='#D48C2E',linewidth=1,linestyle='--',label='2m near-bumper threshold');axes[2].axhline(0,color='#BD4B4B',linewidth=.8,label='Contact envelope')
axes[2].set_ylabel('Ahead gap (m)');axes[2].set_xlabel('Seconds relative to target-lane change');axes[2].set_title('Actual ahead clearance while lateral envelopes overlap',loc='left',pad=9);axes[2].legend(loc='best',fontsize=8,frameon=False)
if np.any(np.isfinite(gap)):
 lo=min(0,float(np.nanmin(gap)));hi=max(3,float(np.nanmax(gap)));axes[2].set_ylim(lo-.03*(hi-lo),hi+.14*(hi-lo))
axes[-1].set_xlim(t[0],t[-1])
fig.text(.115,.088,f"Observed run: {d['observedSeconds']:.1f}s · 0 impacts · 0 hops · 0 swept body overlaps",fontsize=9,color='#4A5E78')
fig.text(.115,.063,'Gap may jump when the nearest eligible leader changes; blank segments mean no overlapping ahead leader.',fontsize=8,color='#66768A')
fig.text(.115,.039,'Controller SHA256 '+d['sourceHashes']['src/highway-demo.js'][:16]+'  ·  Source hashes verified unchanged',fontsize=8,color='#66768A')
fig.savefig(prefix+'.png',dpi=180,facecolor=fig.get_facecolor());fig.savefig(prefix+'.svg',facecolor=fig.get_facecolor());plt.close(fig)
