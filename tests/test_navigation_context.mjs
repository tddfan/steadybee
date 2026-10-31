import test from 'node:test';import assert from 'node:assert/strict';
import {createNavigationContext} from '../prototype/navigation-context.mjs';
test('switching sections and returning restores separate reading positions',()=>{const nav=createNavigationContext();assert.equal(nav.visit('assets'),0);assert.equal(nav.visit('flow',840),0);assert.equal(nav.visit('planning',430),0);assert.equal(nav.visit('assets',220),840);assert.equal(nav.visit('flow',850),430);assert.equal(nav.visit('flow',470),470);});
import {sheetShouldDismiss} from '../prototype/bento-ergonomics.mjs';
test('sheets distinguish a deliberate drag or flick from a short tap or upward release',()=>{assert.equal(sheetShouldDismiss(20,0,600),false);assert.equal(sheetShouldDismiss(140,0,600),true);assert.equal(sheetShouldDismiss(25,.9,600),true);assert.equal(sheetShouldDismiss(5,2,600),false);assert.equal(sheetShouldDismiss(20,-1,600),false);});
