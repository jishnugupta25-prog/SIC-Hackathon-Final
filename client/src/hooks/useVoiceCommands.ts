import { useEffect, useRef, useState } from 'react';

export interface VoiceCommandConfig {
  keywords: string[];
  onCommandDetected: (keyword: string) => void;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onError?: (error: string) => void;
}

export function useVoiceCommands(config: VoiceCommandConfig) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(true);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      config.onError?.('Voice commands not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configuration for improved accuracy
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Use US English for better keyword matching
    recognition.maxAlternatives = 1; // Get best match only

    recognition.onstart = () => {
      setIsListening(true);
      config.onListeningStart?.();
      console.log('[Voice Commands] Listening started');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;

      // Collect results from all events
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript.toLowerCase().trim();
        isFinal = event.results[i].isFinal;
        
        if (isFinal) {
          transcript = result;
          console.log(`[Voice Commands] Final result: "${result}"`);
          
          // Check each keyword with improved matching
          for (const keyword of config.keywords) {
            const keywordLower = keyword.toLowerCase();
            
            // Exact match
            if (transcript === keywordLower) {
              console.log(`[Voice Commands] ✓ Exact match: "${keyword}"`);
              config.onCommandDetected(keyword);
              return;
            }
            
            // Partial match - keyword is contained in transcript
            if (transcript.includes(keywordLower)) {
              console.log(`[Voice Commands] ✓ Partial match: "${keyword}" found in "${transcript}"`);
              config.onCommandDetected(keyword);
              return;
            }
            
            // Fuzzy match - allow for slight variations (typos, accents)
            if (fuzzyMatch(transcript, keywordLower)) {
              console.log(`[Voice Commands] ✓ Fuzzy match: "${keyword}" matched with "${transcript}"`);
              config.onCommandDetected(keyword);
              return;
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice Commands] Error:', event.error);
      // Silently continue listening, don't report errors
    };

    recognition.onend = () => {
      setIsListening(false);
      config.onListeningEnd?.();
      console.log('[Voice Commands] Listening stopped, auto-restarting...');
      
      // Auto restart listening if we should keep going
      if (shouldRestartRef.current) {
        try {
          setTimeout(() => {
            if (shouldRestartRef.current && recognitionRef.current) {
              console.log('[Voice Commands] Restarting listening...');
              recognitionRef.current.start();
            }
          }, 50); // Faster restart for better responsiveness
        } catch (error) {
          console.log('[Voice Commands] Auto-restart failed:', error);
        }
      }
    };

    // Start listening immediately
    try {
      recognition.start();
    } catch (error) {
      console.log('[Voice Commands] Start failed:', error);
    }

    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [config]);

  const stopListening = () => {
    shouldRestartRef.current = false;
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.log('[Voice Commands] Stop failed:', error);
      }
    }
  };

  return {
    isListening,
    stopListening,
  };
}

// Fuzzy matching for voice recognition variations
function fuzzyMatch(input: string, keyword: string): boolean {
  // Allow up to 1 character difference for keywords <= 4 chars
  // Allow up to 2 character differences for longer keywords
  const maxDistance = keyword.length <= 4 ? 1 : 2;
  return levenshteinDistance(input, keyword) <= maxDistance;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array for dynamic programming
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],      // deletion
          dp[i][j - 1],      // insertion
          dp[i - 1][j - 1]   // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}
