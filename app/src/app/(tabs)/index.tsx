import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { APP_CONFIG_SMOKE_KEYS } from '@/lib/appConfigSmoke';

export default function MapScreen() {
  useEffect(() => {
    if (!__DEV__) return;
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', APP_CONFIG_SMOKE_KEYS)
      .then(({ data, error }) => {
        if (error) {
          console.error('[smoke] supabase error:', error.message);
        } else {
          console.log('[smoke] app_config rows:', data?.length ?? 0);
        }
      });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Map (Phase 3)</Text>
    </View>
  );
}
