#!/usr/bin/env python3
"""Run exported leaderboard scripts in the system Lua library, without Redis credentials.

Usage: python3 tests/lua_runtime.py
Requires Node and an already installed Lua 5.3/5.4 shared library. Does not install
software, access the network, or connect to Redis. Redis commands and cjson are
small test shims; this validates real Lua execution, not Upstash connectivity or
Redis's own atomicity guarantees. For live integration, use a separate test DB.
"""

import ctypes
import ctypes.util
import json
from pathlib import Path
import subprocess
import sys
import unittest


class LuaRuntime:
    def __init__(self):
        library = next((ctypes.util.find_library(name) for name in ("lua5.4", "lua5.3")
                        if ctypes.util.find_library(name)), None)
        if not library:
            raise RuntimeError("An installed Lua 5.3/5.4 shared library is required.")
        self.library = library
        self.lua = ctypes.CDLL(library)
        pointer, integer = ctypes.c_void_p, ctypes.c_int
        signatures = {
            "luaL_newstate": ([], pointer),
            "luaL_openlibs": ([pointer], None),
            "lua_close": ([pointer], None),
            "luaL_loadstring": ([pointer, ctypes.c_char_p], integer),
            "lua_pcallk": ([pointer, integer, integer, integer, ctypes.c_longlong, pointer], integer),
            "lua_gettop": ([pointer], integer),
            "lua_settop": ([pointer, integer], None),
            "lua_type": ([pointer, integer], integer),
            "lua_tolstring": ([pointer, integer, ctypes.POINTER(ctypes.c_size_t)], pointer),
            "lua_tonumberx": ([pointer, integer, pointer], ctypes.c_double),
            "lua_toboolean": ([pointer, integer], integer),
            "lua_pushnil": ([pointer], None),
            "lua_pushboolean": ([pointer, integer], None),
            "lua_pushnumber": ([pointer, ctypes.c_double], None),
            "lua_pushlstring": ([pointer, ctypes.c_char_p, ctypes.c_size_t], None),
            "lua_createtable": ([pointer, integer, integer], None),
            "lua_setfield": ([pointer, integer, ctypes.c_char_p], None),
            "lua_rawseti": ([pointer, integer, ctypes.c_longlong], None),
            "lua_next": ([pointer, integer], integer),
            "lua_setglobal": ([pointer, ctypes.c_char_p], None),
            "lua_pushcclosure": ([pointer, pointer, integer], None),
        }
        for name, (args, result) in signatures.items():
            function = getattr(self.lua, name)
            function.argtypes, function.restype = args, result
        self.state = self.lua.luaL_newstate()
        if not self.state:
            raise RuntimeError("Could not create Lua state.")
        self.lua.luaL_openlibs(self.state)
        self.callback_errors = []
        callback_type = ctypes.CFUNCTYPE(integer, pointer)

        def callback(function):
            def run(_state):
                try:
                    self.push(function(self.read(1)))
                except Exception as error:
                    # Never let a Python exception cross the C callback boundary.
                    self.callback_errors.append(error)
                    self.lua.lua_pushnil(self.state)
                return 1
            return callback_type(run)

        self.callbacks = {
            "decode": callback(json.loads),
            "encode": callback(lambda value: json.dumps(value, ensure_ascii=False,
                                                       separators=(",", ":"))),
        }
        self.lua.lua_createtable(self.state, 0, 2)
        for name, function in self.callbacks.items():
            self.lua.lua_pushcclosure(self.state, ctypes.cast(function, pointer), 0)
            self.lua.lua_setfield(self.state, -2, name.encode())
        self.lua.lua_setglobal(self.state, b"cjson")
        self.execute(REDIS_SHIM)

    def close(self):
        if self.state:
            self.lua.lua_close(self.state)
            self.state = None

    def read(self, index):
        kind = self.lua.lua_type(self.state, index)
        if kind == 0:
            return None
        if kind == 1:
            return bool(self.lua.lua_toboolean(self.state, index))
        if kind == 3:
            return self.lua.lua_tonumberx(self.state, index, None)
        if kind == 4:
            size = ctypes.c_size_t()
            data = self.lua.lua_tolstring(self.state, index, ctypes.byref(size))
            return ctypes.string_at(data, size.value).decode("utf-8")
        if kind == 5:
            absolute = index if index > 0 else self.lua.lua_gettop(self.state) + index + 1
            result = {}
            self.lua.lua_pushnil(self.state)
            while self.lua.lua_next(self.state, absolute):
                result[self.read(-2)] = self.read(-1)
                self.lua.lua_settop(self.state, -2)
            if set(result) == set(range(1, len(result) + 1)):
                return [result[key] for key in range(1, len(result) + 1)]
            return result
        raise TypeError(f"Unsupported Lua value type: {kind}")

    def push(self, value):
        if value is None:
            self.lua.lua_pushnil(self.state)
        elif isinstance(value, bool):
            self.lua.lua_pushboolean(self.state, int(value))
        elif isinstance(value, (int, float)):
            self.lua.lua_pushnumber(self.state, value)
        elif isinstance(value, str):
            encoded = value.encode("utf-8")
            self.lua.lua_pushlstring(self.state, encoded, len(encoded))
        elif isinstance(value, (list, tuple)):
            self.lua.lua_createtable(self.state, len(value), 0)
            for index, item in enumerate(value, 1):
                self.push(item)
                self.lua.lua_rawseti(self.state, -2, index)
        elif isinstance(value, dict):
            self.lua.lua_createtable(self.state, 0, len(value))
            for key, item in value.items():
                self.push(item)
                self.lua.lua_setfield(self.state, -2, str(key).encode())
        else:
            raise TypeError(f"Unsupported Python value: {type(value)}")

    def execute(self, source):
        self.lua.lua_settop(self.state, 0)
        code = self.lua.luaL_loadstring(self.state, source.encode())
        if not code:
            code = self.lua.lua_pcallk(self.state, 0, -1, 0, 0, None)
        if self.callback_errors:
            raise RuntimeError("cjson test shim failed") from self.callback_errors.pop(0)
        if code:
            raise RuntimeError(self.read(-1))
        return self.read(-1) if self.lua.lua_gettop(self.state) else None

    def evaluate(self, script, keys, args):
        for name, values in (("KEYS", keys), ("ARGV", [str(x) for x in args])):
            self.push(values)
            self.lua.lua_setglobal(self.state, name.encode())
        return self.execute(script)


REDIS_SHIM = r"""
db = {}; expiries = {}; clock = 0; writes = 0
redis = {}
local function expire(key)
  if expiries[key] and clock >= expiries[key] then
    db[key] = nil; expiries[key] = nil
  end
end
function redis.call(command, key, ...)
  local args = {...}; command = string.upper(command); expire(key)
  if command == 'GET' then
    return db[key] or false
  elseif command == 'SET' then
    local previous_expiry = expiries[key]
    writes = writes + 1; db[key] = args[1]; expiries[key] = nil
    if args[2] == 'PX' then expiries[key] = clock + tonumber(args[3])
    elseif args[2] == 'EX' then expiries[key] = clock + tonumber(args[3]) * 1000
    elseif args[2] == 'KEEPTTL' then expiries[key] = previous_expiry end
    return 'OK'
  elseif command == 'INCR' then
    writes = writes + 1; db[key] = tonumber(db[key] or 0) + 1; return db[key]
  elseif command == 'EXPIRE' then
    writes = writes + 1; expiries[key] = clock + tonumber(args[1]) * 1000; return 1
  elseif command == 'DEL' then
    writes = writes + 1; local present = db[key] ~= nil
    db[key] = nil; expiries[key] = nil; return present and 1 or 0
  elseif command == 'ZSCORE' then
    return db[key] and db[key][args[1]] or false
  elseif command == 'ZADD' then
    writes = writes + 1; db[key] = db[key] or {}
    db[key][args[2]] = tonumber(args[1]); return 1
  elseif command == 'HSET' then
    writes = writes + 1; db[key] = db[key] or {}; db[key][args[1]] = args[2]; return 1
  elseif command == 'HGET' then
    return db[key] and db[key][args[1]] or false
  elseif command == 'ZREVRANK' or command == 'ZREVRANGE' then
    local ordered = {}
    for member,score in pairs(db[key] or {}) do table.insert(ordered, {member,score}) end
    table.sort(ordered, function(a,b)
      if a[2] ~= b[2] then return a[2] > b[2] end
      return a[1] > b[1]
    end)
    if command == 'ZREVRANK' then
      for index,row in ipairs(ordered) do if row[1] == args[1] then return index - 1 end end
      return false
    end
    local result = {}
    for index = tonumber(args[1]) + 1, math.min(tonumber(args[2]) + 1, #ordered) do
      table.insert(result, ordered[index][1]); table.insert(result, tostring(ordered[index][2]))
    end
    return result
  end
  error('Test shim does not implement Redis command: '..command)
end
"""


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import * as m from './lib/leaderboard.mjs';"
    "console.log(JSON.stringify(Object.fromEntries(Object.entries(m)"
    ".filter(([key]) => key.endsWith('_LUA')))));",
], cwd=ROOT, text=True))


class LeaderboardLuaTests(unittest.TestCase):
    def setUp(self):
        self.runtime = LuaRuntime()
        self.addCleanup(self.runtime.close)

    def run_script(self, name, keys, args):
        return self.runtime.evaluate(SCRIPTS[name], keys, args)

    def start(self, player="player1", run_id="run1", started=0, category="highway-realistic"):
        run = dict(runId=run_id, player=player, category=category, startedAt=started,
                   expiresAt=started + 600_000)
        return self.run_script("START_LUA", [f"active:{player}", f"run:{run_id}"],
                               ["run:", json.dumps(run), 600_000, run_id, 65_000])

    def score(self, player="player1", run_id="run1", fingerprint="fp1", now=60_000,
              score=100, name="Player 1", board="highway-realistic"):
        return self.run_script("SCORE_LUA", [f"run:{run_id}", f"board:{board}", f"names:{board}"],
                               [player, fingerprint, now, 60_000, score, name, 600_000])

    def end(self, player="player1", run_id="run1"):
        return self.run_script("END_LUA", [f"run:{run_id}", f"active:{player}"],
                               [player, run_id])

    def listing(self, board="highway-realistic"):
        return self.run_script("LIST_LUA", [f"board:{board}", f"names:{board}"], [])

    def test_start_creates_both_keys_with_correct_ttl(self):
        run = json.loads(self.start())
        self.assertEqual(run["runId"], "run1")
        self.assertEqual(self.runtime.execute("return {expiries['active:player1'],expiries['run:run1']}"),
                         [65_000, 600_000])

    def test_concurrent_start_cannot_create_a_second_unfinished_run(self):
        self.start()
        self.assertEqual(self.start(run_id="run2"), "active")
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run2')"), False)

    def test_finished_run_allows_immediate_new_run(self):
        self.start()
        self.assertEqual(self.score()[0], "ok")
        self.assertEqual(json.loads(self.start(run_id="run2", started=60_001))["runId"], "run2")
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")

    def test_end_cancels_run_without_publishing_and_allows_immediate_new_start(self):
        self.start()
        self.runtime.execute("clock=1234")
        self.assertEqual(self.end(), "ok")
        canceled = json.loads(self.runtime.execute("return redis.call('GET','run:run1')"))
        self.assertTrue(canceled["canceled"])
        self.assertNotIn("receipt", canceled)
        self.assertEqual(self.runtime.execute("return expiries['run:run1']"), 600_000)
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), False)
        self.assertEqual(self.score(), ["canceled"])
        self.assertEqual(self.listing(), [])
        self.assertEqual(json.loads(self.start(run_id="run2", started=1234))["runId"], "run2")
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")

    def test_repeated_end_is_idempotent_and_never_refreshes_original_expiry(self):
        self.start()
        self.runtime.execute("clock=1000")
        self.end()
        before = self.runtime.execute("return writes")
        canceled = self.runtime.execute("return redis.call('GET','run:run1')")
        self.runtime.execute("clock=2000")
        self.assertEqual(self.end(), "ok")
        self.assertEqual(self.runtime.execute("return writes"), before)
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run1')"), canceled)
        self.assertEqual(self.runtime.execute("return expiries['run:run1']"), 600_000)
        self.runtime.execute("clock=600000")
        self.assertEqual(self.end(), "ok")
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run1')"), False)
        self.assertEqual(self.runtime.execute("return writes"), before)

    def test_end_wrong_owner_cannot_cancel_run_or_clear_either_players_lock(self):
        self.start()
        self.runtime.execute("db['active:other']='run1'")
        before = self.runtime.execute("return writes")
        original = self.runtime.execute("return redis.call('GET','run:run1')")
        self.assertEqual(self.end(player="other"), "owner")
        self.assertEqual(self.runtime.execute("return writes"), before)
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run1')"), original)
        self.assertEqual(self.runtime.execute("return {db['active:player1'],db['active:other']}"),
                         ["run1", "run1"])

    def test_start_permits_retained_canceled_run_even_if_old_active_key_remains(self):
        self.start()
        self.end()
        self.runtime.execute("db['active:player1']='run1'")
        self.assertEqual(json.loads(self.start(run_id="run2"))["runId"], "run2")

    def test_delayed_old_end_only_releases_matching_id_after_newer_start(self):
        self.start()
        self.runtime.execute("clock=65000")
        self.start(run_id="run2", started=65_000)
        newer = self.runtime.execute("return redis.call('GET','run:run2')")
        self.assertEqual(self.end(), "ok")
        self.assertEqual(self.end(), "ok")
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run2')"), newer)
        self.assertEqual(self.score(), ["canceled"])
        self.assertEqual(self.score(run_id="run2", now=125_000)[0], "ok")

    def test_expired_or_unknown_old_end_cannot_touch_newer_active_run(self):
        self.start()
        self.runtime.execute("clock=600000")
        self.start(run_id="run2", started=600_000)
        newer = self.runtime.execute("return redis.call('GET','run:run2')")
        before = self.runtime.execute("return writes")
        for run_id in ("run1", "unknown", "run1"):
            self.assertEqual(self.end(run_id=run_id), "ok")
        self.assertEqual(self.runtime.execute("return writes"), before)
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run2')"), newer)

    def test_end_preserves_accepted_receipt_and_its_ttl_and_replay_semantics(self):
        self.start()
        self.runtime.execute("clock=60000")
        receipt = self.score()
        saved = self.runtime.execute("return redis.call('GET','run:run1')")
        expiry = self.runtime.execute("return expiries['run:run1']")
        self.runtime.execute("clock=60001")
        self.assertEqual(self.end(), "ok")
        self.assertEqual(self.runtime.execute("return redis.call('GET','run:run1')"), saved)
        self.assertEqual(self.runtime.execute("return expiries['run:run1']"), expiry)
        self.assertEqual(self.score(), receipt)
        self.assertEqual(self.score(fingerprint="changed"), ["replay"])
        self.assertEqual(self.listing(), [["Player 1", "100"]])
        self.start(run_id="run2", started=60_001)
        self.end()
        self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")

    def test_atomic_score_end_race_is_safe_in_both_serialization_orders(self):
        # Redis serializes each EVAL. Exercise both possible winners with the real Lua,
        # including a score whose preliminary API GET ran before either EVAL.
        for order in (("end", "score"), ("score", "end")):
            with self.subTest(order=order):
                self.runtime.execute(REDIS_SHIM)
                self.start()
                snapshot = json.loads(self.runtime.execute("return redis.call('GET','run:run1')"))
                self.assertNotIn("canceled", snapshot)
                self.runtime.execute("clock=60000")
                results = {action: getattr(self, action)() for action in order}
                self.assertEqual(results["end"], "ok")
                if order[0] == "end":
                    self.assertEqual(results["score"], ["canceled"])
                    self.assertEqual(self.listing(), [])
                else:
                    self.assertEqual(results["score"][0], "ok")
                    self.assertEqual(self.score(), results["score"])
                    self.assertEqual(self.listing(), [["Player 1", "100"]])
                self.start(run_id="run2", started=60_001)
                self.end()
                self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")

    def test_atomic_start_end_race_is_safe_in_both_serialization_orders(self):
        for end_first in (True, False):
            with self.subTest(end_first=end_first):
                self.runtime.execute(REDIS_SHIM)
                self.start()
                if not end_first:
                    self.assertEqual(self.start(run_id="run2"), "active")
                self.assertEqual(self.end(), "ok")
                self.assertEqual(json.loads(self.start(run_id="run2"))["runId"], "run2")
                self.end()
                self.assertEqual(self.runtime.execute("return redis.call('GET','active:player1')"), "run2")
                self.assertNotIn("canceled", json.loads(self.runtime.execute("return redis.call('GET','run:run2')")))

    def test_missing_active_target_recovers(self):
        self.runtime.execute("db['active:player1']='deleted' ")
        self.assertEqual(json.loads(self.start())["runId"], "run1")

    def test_active_key_expires_after_65_seconds(self):
        self.start()
        self.runtime.execute("clock=65000")
        self.assertEqual(json.loads(self.start(run_id="run2", started=65_000))["runId"], "run2")

    def test_missing_owner_early_and_expired_rejections_do_not_write(self):
        self.assertEqual(self.score(), ["missing"])
        self.start()
        before = self.runtime.execute("return writes")
        self.assertEqual(self.score(player="other"), ["owner"])
        self.assertEqual(self.score(now=59_999), ["early"])
        self.assertEqual(self.score(now=600_001), ["expired"])
        self.assertEqual(self.runtime.execute("return writes"), before)
        self.assertEqual(self.listing(), [])

    def test_receipt_is_idempotent_and_conflicting_replay_cannot_write(self):
        self.start()
        first = self.score()
        self.assertEqual(first[0], "ok")
        self.assertEqual(json.loads(first[1]),
                         dict(accepted=True, improved=True, bestScore=100, rank=1))
        before = self.runtime.execute("return writes")
        self.assertEqual(self.score(now=60_001), first)
        self.assertEqual(self.score(fingerprint="changed", score=200), ["replay"])
        self.assertEqual(self.runtime.execute("return writes"), before)
        self.assertEqual(self.listing(), [["Player 1", "100"]])

    def test_lower_and_equal_scores_do_not_replace_best_nickname(self):
        self.start()
        self.score()
        for index, value in enumerate((90, 100), 2):
            run_id = f"run{index}"
            self.start(run_id=run_id, started=60_000)
            receipt = self.score(run_id=run_id, score=value, name="Changed",
                                 now=120_000, fingerprint=f"fp{index}")
            self.assertEqual(json.loads(receipt[1]),
                             dict(accepted=True, improved=False, bestScore=100, rank=1))
        self.assertEqual(self.listing(), [["Player 1", "100"]])

    def test_improvement_replaces_score_and_name(self):
        self.start()
        self.score()
        self.start(run_id="run2", started=60_000)
        result = self.score(run_id="run2", score=200, name="Improved", now=120_000)
        self.assertTrue(json.loads(result[1])["improved"])
        self.assertEqual(self.listing(), [["Improved", "200"]])

    def test_zero_score_and_unicode_name_are_valid(self):
        self.start()
        receipt = json.loads(self.score(score=0, name="飞天干脆面")[1])
        self.assertEqual(receipt["bestScore"], 0)
        self.assertEqual(receipt["rank"], 1)
        self.assertEqual(self.listing(), [["飞天干脆面", "0"]])

    def test_boards_are_isolated_and_ties_follow_reverse_member_order(self):
        for player, name, board in (("player1", "First", "highway-realistic"),
                                     ("player2", "Second", "highway-realistic"),
                                     ("player3", "City", "city-fantasy")):
            self.start(player=player, run_id=player, category=board)
            self.score(player=player, run_id=player, name=name, board=board)
        self.assertEqual(self.listing(), [["Second", "100"], ["First", "100"]])
        self.assertEqual(self.listing("city-fantasy"), [["City", "100"]])

    def test_list_is_capped_at_100_and_hides_member_identifiers(self):
        self.runtime.execute("""for i=1,105 do
            local player=string.format('id%03d',i)
            redis.call('ZADD','board:highway-realistic',i,player)
            redis.call('HSET','names:highway-realistic',player,'Name '..i)
            end""")
        entries = self.listing()
        self.assertEqual(len(entries), 100)
        self.assertEqual(entries[0], ["Name 105", "105"])
        self.assertEqual(entries[-1], ["Name 6", "6"])

    def test_rate_denial_increments_neither_counter(self):
        keys, args = ["rate:ip", "rate:player"], [3, 2, 61]
        self.assertEqual(self.run_script("RATE_LUA", keys, args), 1)
        self.assertEqual(self.run_script("RATE_LUA", keys, args), 1)
        before = self.runtime.execute("return writes")
        self.assertEqual(self.run_script("RATE_LUA", keys, args), 0)
        self.assertEqual(self.runtime.execute("return {db['rate:ip'],db['rate:player']}"), [2, 2])
        self.assertEqual(self.runtime.execute("return writes"), before)

    def test_rate_ttl_is_set_once_and_expiry_resets_counts(self):
        keys, args = ["rate:ip", "rate:player"], [3, 2, 61]
        self.run_script("RATE_LUA", keys, args)
        self.runtime.execute("clock=1000")
        self.run_script("RATE_LUA", keys, args)
        self.assertEqual(self.runtime.execute("return {expiries['rate:ip'],expiries['rate:player']}"),
                         [61_000, 61_000])
        self.runtime.execute("clock=61000")
        self.assertEqual(self.run_script("RATE_LUA", keys, args), 1)
        self.assertEqual(self.runtime.execute("return {db['rate:ip'],db['rate:player']}"), [1, 1])

    def test_single_key_public_read_rate_has_correct_argument_index(self):
        for expected in (1, 1, 0):
            self.assertEqual(self.run_script("RATE_LUA", ["rate:list"], [2, 61]), expected)
        self.assertEqual(self.runtime.execute("return expiries['rate:list']"), 61_000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
