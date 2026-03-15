import { cn } from '@/lib/utils';

export function cx(...inputs: Array<string | false | null | undefined>) {
  return cn(...inputs);
}
