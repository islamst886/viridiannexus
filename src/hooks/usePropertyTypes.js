import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const DEFAULT_TYPES = [
  'Apartment', 'Penthouse', 'Luxury Apartment', 'Duplex',
  'Smart Home', 'Villa', 'Townhouse', 'Commercial',
];

/**
 * usePropertyTypes
 * Subscribes to the Supabase settings table (key='property_types') in real time.
 * Returns { types, loading } — types is always sorted alphabetically.
 */
export function usePropertyTypes() {
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTypes = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'property_types')
        .single();

      const fetched = data?.value?.types;
      if (Array.isArray(fetched) && fetched.length > 0) {
        setTypes([...fetched].sort());
      } else {
        // First run — seed defaults into Supabase
        await supabase
          .from('settings')
          .upsert({ key: 'property_types', value: { types: DEFAULT_TYPES } });
        setTypes(DEFAULT_TYPES);
      }
      setLoading(false);
    };

    fetchTypes();

    // Realtime subscription
    const sub = supabase
      .channel('property_types_setting')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.property_types',
        },
        (payload) => {
          const t = payload.new?.value?.types;
          if (Array.isArray(t)) setTypes([...t].sort());
        }
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  return { types, loading };
}

/**
 * addPropertyType — adds a new type to Supabase settings.
 * Returns the updated array.
 */
export async function addPropertyType(newType, currentTypes) {
  const updated = [...new Set([...currentTypes, newType.trim()])].sort();
  await supabase
    .from('settings')
    .upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}

/**
 * removePropertyType — removes a type from Supabase settings.
 */
export async function removePropertyType(typeToRemove, currentTypes) {
  const updated = currentTypes.filter((t) => t !== typeToRemove);
  await supabase
    .from('settings')
    .upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}
