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

    // Configuration
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Support Indian English

    recognition.onstart = () => {
      setIsListening(true);
      config.onListeningStart?.();
      console.log('[Voice Commands] Listening started');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';

      // Collect results from all events
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const isFinal = event.results[i].isFinal;
        const result = event.results[i][0].transcript.toLowerCase().trim();
        transcript += result;

        if (isFinal) {
          console.log(`[Voice Commands] Detected: "${result}"`);

          // Check if any keyword is in the transcript
          for (const keyword of config.keywords) {
            if (transcript.includes(keyword.toLowerCase())) {
              console.log(`[Voice Commands] ✓ Keyword matched: "${keyword}"`);
              config.onCommandDetected(keyword);
              break;
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
          }, 100);
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
