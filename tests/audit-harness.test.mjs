import test from 'node:test';import assert from 'node:assert/strict';
import {E,locations,Meter,observe} from '../game-audit/lib/harness.mjs';
test('audit distinguishes zero errors from zero opportunities',()=>{const m=new Meter();m.check('law',false,{},false);const r=m.report().checks.law;assert.equal(r.denominator,0);assert.equal(r.status,'NOT_CHECKED');assert.equal(r.unsupported,1);});
test('audit observes choice transitions as well as advance boundaries',()=>{const m=new Meter(),l=E.createLife({locations,seed:'audit-boundary'});observe(l,m,'startLife');assert.equal(m.calls.startLife,1);assert.equal(m.report().checks.TIMELINE.denominator,1);observe(l,m,'advanceYear');assert.equal(m.report().checks.TIMELINE.denominator,2);});
