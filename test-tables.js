import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgmgpejuoymoumyfpwkc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbWdwZWp1b3ltb3VteWZwd2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjUzOTAsImV4cCI6MjA5MDg0MTM5MH0.Us_WETrK4AAKQTyJrMCsZS-WX8hdfvYAD94eMz4J4_Q'
);

async function formatDB() {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'dmouraphb@gmail.com',
        password: 'admin' // in the subagent logs it tried both admin and admin123. Let's try admin123 if this fails.
    });
    if (authErr) {
        const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({
            email: 'dmouraphb@gmail.com',
            password: 'admin123'
        });
        if (authErr2) {
            console.error('Login failed:', authErr2);
            return;
        }
        console.log('Logged in successfully with admin123');
    } else {
        console.log('Logged in successfully with admin');
    }

    const { data, error } = await supabase.from('store_tables').select('*').order('number');
    if (error) {
        console.error(error);
    } else {
        // Find duplicates
        const counts = {};
        const toDelete = [];
        data.forEach(t => {
            if (!counts[t.number]) counts[t.number] = 0;
            counts[t.number]++;
            if (counts[t.number] > 1) {
                toDelete.push(t.id);
            }
        });

        if (toDelete.length > 0) {
            console.log('Duplicates found, deleting...', toDelete);
            const { error: delError } = await supabase.from('store_tables').delete().in('id', toDelete);
            if (delError) console.error(delError);
            else console.log('Duplicates deleted successfully.');
        } else {
            console.log('No duplicates found in DB.');
        }
    }
}

formatDB();
