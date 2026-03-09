import { createClient } from 'npm:@supabase/supabase-js@2.29.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => null);
    if (!body || !body.set_id || !body.room_id) {
      return new Response(JSON.stringify({ error: 'Missing set_id or room_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { set_id, room_id } = body;

    // Get room members
    const { data: members, error: membersErr } = await supabase
      .from('room_member')
      .select('user_id')
      .eq('room_id', room_id);
    if (membersErr) throw membersErr;
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'No members in room' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch white cards for set
    const { data: cards, error: cardsErr } = await supabase
      .from('cards')
      .select('id')
      .eq('set_id', set_id)
      .eq('is_black', false);
    if (cardsErr) throw cardsErr;
    if (!cards || cards.length === 0) {
      return new Response(JSON.stringify({ error: 'No white cards for set' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Shuffle cards pool
    const cardPool = cards.map(c => c.id);
    for (let i = cardPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPool[i], cardPool[j]] = [cardPool[j], cardPool[i]];
    }

    // Build inserts: 8 cards per user without replacement
    const inserts = [];
    let poolIndex = 0;
    for (const m of members) {
      const user_id = m.user_id;
      for (let k = 0; k < 8; k++) {
        if (poolIndex >= cardPool.length) break; // stop if out of cards
        inserts.push({ user_id, card_id: cardPool[poolIndex++], room_id, created_at: new Date().toISOString() });
      }
    }

    if (inserts.length === 0) {
      return new Response(JSON.stringify({ error: 'Not enough cards to deal' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: insertData, error: insertErr } = await supabase.from('hand_cards').insert(inserts).select('*');
    if (insertErr) throw insertErr;

    // Remaining cards (those not assigned)
    const remainingCardIds = cardPool.slice(poolIndex);
    let remainingInsertResult = null;
    if (remainingCardIds.length > 0) {
      const remainingInserts = remainingCardIds.map(id => ({ card_id: id, room_id, created_at: new Date().toISOString() }));
      const { data: remData, error: remErr } = await supabase.from('remaining_cards').insert(remainingInserts).select('*');
      if (remErr) throw remErr;
      remainingInsertResult = remData;
    }

    // Get room code for channel
    const { data: room, error: roomErr } = await supabase.from('rooms').select('code').eq('id', room_id).single();
    if (roomErr) throw roomErr;
    const channel = room.code;




    const payload = { event: 'cards_dealt', room_id, set_id };
    let broadcastWarning = null;

    supabase.channel(channelCode)

    // try {
    //   await supabase.rpc('realtime_broadcast', { _topic: channel, _event: 'cards_dealt', _payload: JSON.stringify(payload) });
    // } catch (e) {
    //   broadcastWarning = 'Broadcast RPC failed or not available. Ensure a broadcast SQL function exists.';
    // }

    const result = { dealt: insertData.length, remaining: remainingCardIds.length, warning: broadcastWarning };
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
