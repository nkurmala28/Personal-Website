import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validName,validScore} from '../src/leaderboard-policy.mjs';
test('public player names reject markup, profanity and common disguises',()=>{
  for (const n of ['Player 20481','Nikhil','Goal Getter','Sam-23']) assert.equal(validName(n),true,n);
  for (const n of ['a','a'.repeat(21),'<script>', 'f u c k','sh1t','nazi','ＦＵＣＫ','bad\nname']) assert.equal(validName(n),false,n);
});
test('only integer five-shot scores are accepted',()=>{
  for(const s of [0,1,5]) assert.equal(validScore(s),true);
  for(const s of [-1,6,2.5,'5',null,NaN]) assert.equal(validScore(s),false);
});
