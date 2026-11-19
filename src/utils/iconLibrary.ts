import type { LucideIcon } from 'lucide-react';
import {
  Shield, Wifi, Car, Trees, Waves, Dumbbell, Flower2, ArrowUpCircle,
  UserCircle, Zap, Sun, Video, Flame, Droplets, Smile, Baby,
  Briefcase, BatteryCharging, Navigation, Users, Dog, Trash,
  Film, Camera, Coffee, Wind, Snowflake, Activity, Book,
  Gamepad2, Music, MapPin, Key, Lock, ShieldCheck, Eye,
  Plane, ShoppingBag, ShoppingCart, Train, Bus, Building,
  Building2, Home, Utensils, Heart, Stethoscope, Plus,
  Anchor, Palmtree, Tv, CheckCircle, Bell, PhoneCall,
} from 'lucide-react';

export const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  Shield,
  Wifi,
  Car,
  Trees,
  Waves,
  Dumbbell,
  Flower2,
  ArrowUpCircle,
  UserCircle,
  Zap,
  Sun,
  Video,
  Flame,
  Droplets,
  Smile,
  Baby,
  Briefcase,
  BatteryCharging,
  Navigation,
  Users,
  Dog,
  Trash,
  Film,
  Camera,
  Coffee,
  Wind,
  Snowflake,
  Activity,
  Book,
  Gamepad2,
  Music,
  MapPin,
  Key,
  Lock,
  ShieldCheck,
  Eye,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Train,
  Bus,
  Building,
  Building2,
  Home,
  Utensils,
  Heart,
  Stethoscope,
  Plus,
  Anchor,
  Palmtree,
  Tv,
  CheckCircle,
  Bell,
  PhoneCall,
};

/**
 * Resolves a Lucide icon component by name (exact or case-insensitive) with a CheckCircle fallback.
 */
export function resolveAmenityIcon(iconName?: string | null): LucideIcon {
  if (typeof iconName === 'string') {
    const trimmed = iconName.trim();
    if (trimmed) {
      if (AVAILABLE_ICONS[trimmed]) {
        return AVAILABLE_ICONS[trimmed];
      }
      const lower = trimmed.toLowerCase();
      const matched = Object.entries(AVAILABLE_ICONS).find(
        ([key]) => key.toLowerCase() === lower
      );
      if (matched) {
        return matched[1];
      }
    }
  }
  return CheckCircle;
}
