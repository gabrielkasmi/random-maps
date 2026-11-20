#!/bin/sh
# Copies the rules and the data into the Edge Function before a deploy (the copies are gitignored).
# Then, from explorer/:  npx supabase functions deploy pvx-submit --project-ref zelhliylrlktnasircwp
set -e
cd "$(dirname "$0")/.."
F=supabase/functions/pvx-submit
cp js/game.js "$F/game.js"
cp data/nodes.json "$F/nodes.json"
cp data/config.json "$F/config.json"
echo "synced game.js, nodes.json, config.json (data $(grep -o '"data":"[^"]*"' data/config.json))"
