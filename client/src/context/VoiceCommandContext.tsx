import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface VoiceCommandContextType {
  isListening: boolean;
}

const VoiceCommandContext = createContext<VoiceCommandContextType>({ isListening: false });

export function useGlobalVoiceCommands() {
  return useContext(VoiceCommandContext);
}

// Fuzzy matching for voice recognition variations
function fuzzyMatch(input: string, keyword: string): boolean {
  const maxDistance = keyword.length <= 4 ? 1 : 2;
  return levenshteinDistance(input, keyword) <= maxDistance;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }
  
  return dp[m][n];
}

let globalRecognition: any = null;
let shouldKeepListening = false;
let isCurrentlyListening = false;

export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const listenerRef = useRef<((isListening: boolean) => void) | null>(null);

  useEffect(() => {
    // Only initialize when authenticated
    if (!isAuthenticated || authLoading) {
      shouldKeepListening = false;
      isCurrentlyListening = false;
      if (globalRecognition) {
        try {
          globalRecognition.stop();
        } catch (e) {
          // Ignore
        }
      }
      return;
    }

    shouldKeepListening = true;

    // Initialize speech recognition only once
    if (!globalRecognition) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error('[Global Voice] Speech Recognition not supported');
        return;
      }

      globalRecognition = new SpeechRecognition();
      globalRecognition.continuous = true;
      globalRecognition.interimResults = true;
      globalRecognition.lang = 'en-US';
      globalRecognition.maxAlternatives = 1;

      globalRecognition.onstart = () => {
        isCurrentlyListening = true;
        if (listenerRef.current) listenerRef.current(true);
        console.log('[Global Voice] Listening started');
      };

      globalRecognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const isFinal = event.results[i].isFinal;
          if (!isFinal) continue;

          const result = event.results[i][0].transcript.toLowerCase().trim();
          console.log(`[Global Voice] Final result: "${result}"`);

          const keywords = ['SOS', 'emergency', 'help', 'danger', 'mayday'];
          
          for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();
            
            // Exact match
            if (result === keywordLower) {
              console.log(`[Global Voice] ✓ Exact match: "${keyword}"`);
              window.dispatchEvent(new CustomEvent('voiceCommandDetected', { 
                detail: { keyword } 
              }));
              return;
            }
            
            // Partial match
            if (result.includes(keywordLower)) {
              console.log(`[Global Voice] ✓ Partial match: "${keyword}"`);
              window.dispatchEvent(new CustomEvent('voiceCommandDetected', { 
                detail: { keyword } 
              }));
              return;
            }
            
            // Fuzzy match
            if (fuzzyMatch(result, keywordLower)) {
              console.log(`[Global Voice] ✓ Fuzzy match: "${keyword}"`);
              window.dispatchEvent(new CustomEvent('voiceCommandDetected', { 
                detail: { keyword } 
              }));
              return;
            }
          }
        }
      };

      globalRecognition.onerror = (event: any) => {
        console.error('[Global Voice] Error:', event.error);
      };

      globalRecognition.onend = () => {
        isCurrentlyListening = false;
        if (listenerRef.current) listenerRef.current(false);
        console.log('[Global Voice] Listening stopped, auto-restarting...');
        
        if (shouldKeepListening && globalRecognition) {
          setTimeout(() => {
            if (shouldKeepListening && globalRecognition) {
              try {
                console.log('[Global Voice] Restarting...');
                globalRecognition.start();
              } catch (e) {
                console.log('[Global Voice] Restart failed:', e);
              }
            }
          }, 50);
        }
      };
    }

    // Start listening
    try {
      globalRecognition.start();
    } catch (e) {
      console.log('[Global Voice] Start failed:', e);
    }

    return () => {
      // Don't stop on unmount - keep listening
    };
  }, [isAuthenticated, authLoading]);

  return (
    <VoiceCommandContext.Provider value={{ isListening: isCurrentlyListening }}>
      {children}
    </VoiceCommandContext.Provider>
  );
}
