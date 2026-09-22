import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const SETTINGS_DOC = doc(db, 'settings', 'propertyTypes');

const DEFAULT_TYPES = [
  'Apartment', 'Penthouse', 'Luxury Apartment', 'Duplex',
  'Smart Home', 'Villa', 'Townhouse', 'Commercial',
];

/**
 * usePropertyTypes
 * Subscribes to the Firestore settings/propertyTypes document in real time.
 * Returns { types, loading } — types is always sorted alphabetically.
 */
export function usePropertyTypes() {
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(SETTINGS_DOC, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTypes(Array.isArray(data.types) && data.types.length > 0 ? [...data.types].sort() : DEFAULT_TYPES);
      } else {
        // First run – seed defaults into Firestore
        setDoc(SETTINGS_DOC, { types: DEFAULT_TYPES }).catch(console.error);
        setTypes(DEFAULT_TYPES);
      }
      setLoading(false);
    }, console.error);
    return unsub;
  }, []);

  return { types, loading };
}

/**
 * addPropertyType – adds a new type to Firestore.
 * Returns the updated array.
 */
export async function addPropertyType(newType, currentTypes) {
  const updated = [...new Set([...currentTypes, newType.trim()])].sort();
  await setDoc(SETTINGS_DOC, { types: updated });
  return updated;
}

/**
 * removePropertyType – removes a type from Firestore.
 */
export async function removePropertyType(typeToRemove, currentTypes) {
  const updated = currentTypes.filter(t => t !== typeToRemove);
  await setDoc(SETTINGS_DOC, { types: updated });
  return updated;
}
