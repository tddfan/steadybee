import test from 'node:test';
import assert from 'node:assert/strict';
import {updateSaveStatus} from '../prototype/save-status.mjs';

test('device renders do not replace the signed-in account save status',()=>{
  const element={dataset:{},textContent:''};
  updateSaveStatus(element,'device','Example · not saved');
  updateSaveStatus(element,'account','Saved to your account');
  updateSaveStatus(element,'device','Not saved · this tab only');
  assert.equal(element.textContent,'Saved to your account');
  updateSaveStatus(element,'account','Saving to your account…');
  updateSaveStatus(element,'device','Not saved · this tab only');
  assert.equal(element.textContent,'Saving to your account…');
  updateSaveStatus(element,'account',null);
  assert.equal(element.textContent,'Not saved · this tab only');
});
