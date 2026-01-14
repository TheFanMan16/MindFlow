import React, { useState, useEffect, useRef, useCallback } from 'react';

const FeynmanInterface = () => {
  const [segments, setSegments] = useState([]);
  const [text, setText] = useState('');
  const [previousText, setPreviousText] = useState(''); // Track previous text for comment resolution
  const [simplicityScore, setSimplicityScore] = useState(100);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [fixedSegmentId, setFixedSegmentId] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState('5yo'); // '5yo', 'skeptic', 'interviewer'
  const [marginComments, setMarginComments] = useState([]); // Array of comment objects
  const [resolvedCommentIds, setResolvedCommentIds] = useState(new Set()); // Track resolved comments
  const contentEditableRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const textAreaRef = useRef(null);
  const marginRef = useRef(null);

  // Helper: Count syllables in a word (approximation)
  const countSyllables = (word) => {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  };

  // Detect passive voice patterns
  const hasPassiveVoice = (sentence) => {
    const passivePatterns = [
      /\bwas\s+\w+ed\s+by\b/i,
      /\bwere\s+\w+ed\s+by\b/i,
      /\bis\s+\w+ed\s+by\b/i,
      /\bare\s+\w+ed\s+by\b/i,
      /\bbeen\s+\w+ed\s+by\b/i,
      /\bbeing\s+\w+ed\s+by\b/i,
      /\bwas\s+\w+ed\b/i,
      /\bwere\s+\w+ed\b/i,
      /\bis\s+\w+ed\b/i,
      /\bare\s+\w+ed\b/i,
    ];
    return passivePatterns.some(pattern => pattern.test(sentence));
  };

  // Analyze text complexity and split into segments
  const analyzeComplexity = useCallback((inputText) => {
    if (!inputText.trim()) {
      setSegments([]);
      setSimplicityScore(100);
      return;
    }

    // Split text into sentences (simple regex - can be improved)
    const sentences = inputText
      .split(/([.!?]+(?:\s|$))/g)
      .filter(s => s.trim().length > 0)
      .reduce((acc, curr, idx) => {
        if (idx % 2 === 0) {
          acc.push(curr.trim());
        } else {
          if (acc.length > 0) {
            acc[acc.length - 1] += curr.trim();
          }
        }
        return acc;
      }, [])
      .filter(s => s.trim().length > 0);

    if (sentences.length === 0) {
      setSegments([]);
      setSimplicityScore(100);
      return;
    }

    // Analyze each sentence
    const analyzedSegments = sentences.map((sentence, index) => {
      const wordCount = sentence.split(/\s+/).filter(w => w.trim().length > 0).length;
      const isPassive = hasPassiveVoice(sentence);
      const isLong = wordCount > 18;
      const isComplex = isLong || isPassive;

      return {
        id: index + 1,
        text: sentence,
        status: isComplex ? 'complex' : 'simple',
        wordCount,
        isPassive,
      };
    });

    setSegments(analyzedSegments);

    // Calculate simplicity score (0-100)
    const simpleCount = analyzedSegments.filter(s => s.status === 'simple').length;
    const score = Math.round((simpleCount / analyzedSegments.length) * 100);
    setSimplicityScore(score);
  }, []);

  // Check understanding (filler words + abstract nouns detection)
  const checkUnderstanding = useCallback((inputText, persona) => {
    if (!inputText.trim()) {
      setMarginComments([]);
      return;
    }

    const comments = [];
    const lines = inputText.split('\n');
    
    // Filler words to detect (vague language)
    const fillerWords = [
      'basically', 'literally', 'thing', 'things', 'stuff', 'things',
      'sort of', 'kind of', 'somehow', 'somewhat', 'rather',
      'pretty much', 'more or less', 'you know', 'i mean',
      'just', 'only', 'simply', 'really', 'actually',
    ];

    // Abstract nouns to detect (commonly used without definition)
    const abstractNouns = [
      'optimization', 'optimize', 'optimized',
      'synergy', 'synergistic',
      'leverage', 'leveraging',
      'utilize', 'utilization',
      'facilitate', 'facilitation',
      'implement', 'implementation',
      'deployment', 'deploy',
      'scalability', 'scalable',
      'robustness', 'robust',
      'resilience', 'resilient',
      'efficiency', 'efficient',
      'effectiveness', 'effective',
      'paradigm', 'paradigmatic',
      'methodology', 'methodological',
      'framework', 'frameworks',
      'architecture', 'architectural',
      'infrastructure', 'infrastructural',
      'ecosystem', 'ecosystems',
      'iteration', 'iterative',
      'abstraction', 'abstract',
      'encapsulation', 'encapsulate',
      'polymorphism', 'polymorphic',
      'inheritance', 'inherit',
      'recursion', 'recursive',
    ];

    // Check each line for filler words and abstract nouns
    lines.forEach((line, lineIndex) => {
      // Check for filler words first (more common issue)
      fillerWords.forEach((filler) => {
        // Handle multi-word fillers like "sort of", "kind of"
        const fillerRegex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (fillerRegex.test(line)) {
          // Generate persona-specific comment for filler words
          let commentText = '';
          const matchedFiller = line.match(fillerRegex)?.[0] || filler;
          
          switch (persona) {
            case '5yo':
              commentText = `What do you mean by "${matchedFiller}"? Be specific!`;
              break;
            case 'skeptic':
              commentText = `Wait, what do you mean by "${matchedFiller}"? Be more precise.`;
              break;
            case 'interviewer':
              commentText = `Can you replace "${matchedFiller}" with something more concrete?`;
              break;
            default:
              commentText = `Vague word detected: "${matchedFiller}". Can you be more specific?`;
          }
          
          // Check if we already have a comment for this line and filler
          const existingComment = comments.find(c => 
            c.line === lineIndex && 
            c.targetWord.toLowerCase() === matchedFiller.toLowerCase()
          );
          if (!existingComment) {
            comments.push({
              id: Date.now() + lineIndex + Math.random(),
              lineIndex,
              line: lineIndex,
              text: commentText,
              targetWord: matchedFiller,
              targetLine: line.trim(),
              status: 'active',
              type: 'filler',
            });
          }
        }
      });
      
      // Check for abstract nouns (if no filler words found in this line)
      const hasFillerInLine = fillerWords.some(f => new RegExp(`\\b${f.replace(/\s+/g, '\\s+')}\\b`, 'i').test(line));
      if (!hasFillerInLine) {
        abstractNouns.forEach((noun) => {
          const regex = new RegExp(`\\b${noun}\\b`, 'i');
          if (regex.test(line)) {
            // Check if the word is defined nearby (within 50 characters before or after)
            const nounIndex = line.toLowerCase().indexOf(noun);
            const beforeContext = line.substring(Math.max(0, nounIndex - 50), nounIndex);
            const afterContext = line.substring(nounIndex + noun.length, Math.min(line.length, nounIndex + noun.length + 50));
            const fullContext = beforeContext + ' ' + afterContext;
            
            // Check if there's a definition pattern nearby
            const definitionPatterns = [
              new RegExp(`\\b${noun}\\s+(is|means|refers to|denotes|signifies)\\b`, 'i'),
              new RegExp(`\\b(\\w+\\s+){0,3}(is|means|refers to|denotes|signifies)\\s+${noun}\\b`, 'i'),
            ];
            
            const hasDefinition = definitionPatterns.some(pattern => pattern.test(fullContext));
            
            if (!hasDefinition) {
              // Generate persona-specific comment
              let commentText = '';
              const matchedNoun = line.match(new RegExp(`\\b(${noun})\\b`, 'i'))?.[0] || noun;
              
              switch (persona) {
                case '5yo':
                  commentText = `What is "${matchedNoun}"? Can you explain it like I'm 5 years old?`;
                  break;
                case 'skeptic':
                  commentText = `You mentioned "${matchedNoun}" but I don't understand what it means. Is this a real thing or just jargon?`;
                  break;
                case 'interviewer':
                  commentText = `Can you give me a concrete example of "${matchedNoun}"? How would I use this in practice?`;
                  break;
                default:
                  commentText = `I don't get it. What is "${matchedNoun}" in this context?`;
              }
              
              // Check if we already have a comment for this line and word
              const existingComment = comments.find(c => 
                c.line === lineIndex && 
                c.targetWord.toLowerCase() === noun.toLowerCase()
              );
              if (!existingComment) {
                comments.push({
                  id: Date.now() + lineIndex + Math.random(),
                  lineIndex,
                  line: lineIndex,
                  text: commentText,
                  targetWord: matchedNoun,
                  targetLine: line.trim(),
                  status: 'active',
                  type: 'abstract',
                });
              }
            }
          }
        });
      }
    });

    // Filter out comments that were resolved and update state
    const activeComments = comments.filter(c => !resolvedCommentIds.has(c.id));
    
    // Update margin comments only if there's a change
    setMarginComments(prev => {
      const prevIds = new Set(prev.map(c => c.id));
      const newIds = new Set(activeComments.map(c => c.id));
      
      // Only update if comments changed
      if (prevIds.size !== newIds.size || ![...prevIds].every(id => newIds.has(id))) {
        return activeComments;
      }
      return prev;
    });
  }, [resolvedCommentIds]);

  // Debounced feedback generation (2 seconds after typing stops)
  useEffect(() => {
    // Clear existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Set new timeout for feedback generation
    if (text.trim()) {
      feedbackTimeoutRef.current = setTimeout(() => {
        checkUnderstanding(text, selectedPersona);
        setPreviousText(text); // Store current text for comparison
      }, 2000); // 2 second debounce
    } else {
      setMarginComments([]);
      setPreviousText('');
    }

    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [text, selectedPersona, checkUnderstanding]);

  // Check if comments should be resolved (when text is edited)
  useEffect(() => {
    if (!previousText || !text || marginComments.length === 0) return;

    // Check each comment to see if the target line has been edited
    const newResolvedIds = new Set(resolvedCommentIds);
    
    marginComments.forEach((comment) => {
      const lines = text.split('\n');
      const previousLines = previousText.split('\n');
      
      // Get the current and previous versions of the line
      const currentLine = lines[comment.line] || '';
      const previousLine = previousLines[comment.line] || '';
      
      // Check if the line has been edited (changed from previous version)
      const lineEdited = currentLine.trim() !== previousLine.trim() && previousLine.trim() !== '';
      
      // Also check if target word is removed or replaced
      const targetWordRegex = new RegExp(`\\b${comment.targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const stillHasWord = targetWordRegex.test(currentLine);
      
      // Check if the target word/filler is removed or line changed significantly
      const targetWordRegex = new RegExp(`\\b${comment.targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
      const stillHasWord = targetWordRegex.test(currentLine);
      
      // Resolve if line was edited (user rewrote the sentence) OR word was removed
      if ((lineEdited || !stillHasWord) && !newResolvedIds.has(comment.id)) {
        newResolvedIds.add(comment.id);
        
        // Update comment status to 'resolved' first (shows green)
        setMarginComments(prev => prev.map(c => 
          c.id === comment.id 
            ? { ...c, status: 'resolved' }
            : c
        ));
        setResolvedCommentIds(newResolvedIds);
        
        // Remove comment after fade-out animation
        setTimeout(() => {
          setMarginComments(prev => prev.filter(c => c.id !== comment.id));
          setResolvedCommentIds(prev => {
            const updated = new Set(prev);
            updated.delete(comment.id);
            return updated;
          });
        }, 1000); // 1 second fade-out
      }
    });
  }, [text, previousText, marginComments, resolvedCommentIds]);

  // Handle text changes in contentEditable
  const handleInput = useCallback((e) => {
    const newText = e.target.textContent || e.target.innerText || '';
    setText(newText);
    
    // Use setTimeout to ensure segments are updated before checking cursor position
    setTimeout(() => {
      analyzeComplexity(newText);

      // Track cursor position
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && contentEditableRef.current) {
        const range = selection.getRangeAt(0);
        const preCaretRange = document.createRange();
        preCaretRange.selectNodeContents(contentEditableRef.current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        const caretPosition = preCaretRange.toString().length;
        setCursorPosition(caretPosition);

        // Find which segment the cursor is in
        let currentPos = 0;
        let found = false;
        const currentSegments = text.split(/([.!?]+\s*)/).filter(s => s.trim().length > 0);
        
        for (let i = 0; i < currentSegments.length; i++) {
          const segmentLength = currentSegments[i].length;
          if (caretPosition >= currentPos && caretPosition <= currentPos + segmentLength) {
            // Find corresponding segment in analyzed segments
            setTimeout(() => {
              const analyzedSegs = text.split(/([.!?]+\s*)/)
                .filter(s => s.trim().length > 0)
                .reduce((acc, curr, idx) => {
                  if (idx % 2 === 0) acc.push(curr.trim());
                  else if (acc.length > 0) acc[acc.length - 1] += curr.trim();
                  return acc;
                }, [])
                .filter(s => s.trim().length > 0);
              
              if (i < analyzedSegs.length) {
                setActiveSegmentId(i + 1);
              }
            }, 0);
            found = true;
            break;
          }
          currentPos += segmentLength;
        }
        
        if (!found) {
          setActiveSegmentId(null);
        }
      }
    }, 0);
  }, [analyzeComplexity, text]);

  // Simplify a complex sentence (simulate AI fix)
  const simplifySentence = (sentence) => {
    // Simple heuristics for simplification (can be enhanced with AI later)
    let simplified = sentence;

    // Remove passive voice
    simplified = simplified.replace(/\bwas\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1');
    simplified = simplified.replace(/\bwere\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1');
    simplified = simplified.replace(/\bis\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1');
    simplified = simplified.replace(/\bare\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1');

    // Shorten long sentences by removing filler words
    const fillerWords = /\b(very|quite|rather|somewhat|fairly|pretty|really|actually|basically|essentially|definitely|certainly|obviously|clearly|simply|just|only|merely|even|also|too|as well)\b/gi;
    simplified = simplified.replace(fillerWords, '');

    // Remove redundant phrases
    simplified = simplified.replace(/\b(it is|there is|there are|it has been|there has been)\s+/gi, '');
    simplified = simplified.replace(/\b(due to the fact that|in order to|for the purpose of)\b/gi, 'to');
    simplified = simplified.replace(/\b(in spite of the fact that|despite the fact that)\b/gi, 'although');

    // Clean up multiple spaces
    simplified = simplified.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (simplified.length > 0) {
      simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);
    }

    // If still very long, truncate intelligently
    const words = simplified.split(' ');
    if (words.length > 15) {
      // Try to cut at a comma or conjunction
      const cutPoints = simplified.match(/[,;]\s/g);
      if (cutPoints && cutPoints.length > 0) {
        const midPoint = Math.floor(simplified.length / 2);
        const nearestCut = simplified.substring(0, midPoint).lastIndexOf(',');
        if (nearestCut > simplified.length / 3) {
          simplified = simplified.substring(0, nearestCut + 1);
        } else {
          simplified = words.slice(0, 15).join(' ') + '...';
        }
      } else {
        simplified = words.slice(0, 15).join(' ') + '...';
      }
    }

    return simplified.length > 0 ? simplified : sentence;
  };

  // Handle Tab key to simplify
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && activeSegmentId) {
      const activeSegment = segments.find(s => s.id === activeSegmentId);
      if (activeSegment && activeSegment.status === 'complex') {
        e.preventDefault();

        // Find the segment in the text and replace it
        const segmentIndex = segments.findIndex(s => s.id === activeSegmentId);
        const beforeSegments = segments.slice(0, segmentIndex);
        const afterSegments = segments.slice(segmentIndex + 1);

        const beforeText = beforeSegments.map(s => s.text).join('. ') + (beforeSegments.length > 0 ? '. ' : '');
        const afterText = (afterSegments.length > 0 ? ' ' : '') + afterSegments.map(s => s.text).join('. ');

        const simplified = simplifySentence(activeSegment.text);
        const newText = beforeText + simplified + afterText;

        setText(newText);
        setFixedSegmentId(activeSegmentId);
        setActiveSegmentId(null);

        // Flash green effect will be handled by CSS
        setTimeout(() => {
          setFixedSegmentId(null);
        }, 500);

        // Update contentEditable and re-analyze
        if (contentEditableRef.current) {
          // Force update by setting innerHTML (will be replaced by segment rendering)
          contentEditableRef.current.textContent = newText;
          
          // Re-analyze immediately
          analyzeComplexity(newText);
          
          // Set cursor to end of simplified segment after a brief delay
          setTimeout(() => {
            const range = document.createRange();
            const selection = window.getSelection();
            const textNode = contentEditableRef.current.firstChild || contentEditableRef.current;
            const offset = (beforeText + simplified).length;
            if (textNode && textNode.textContent) {
              range.setStart(textNode, Math.min(offset, textNode.textContent.length));
              range.setEnd(textNode, Math.min(offset, textNode.textContent.length));
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 50);
        }
      }
    }
  }, [activeSegmentId, segments, analyzeComplexity]);

  // Render styled segments into contentEditable
  useEffect(() => {
    if (!contentEditableRef.current || !text.trim() || segments.length === 0) {
      if (contentEditableRef.current && !text.trim()) {
        contentEditableRef.current.textContent = '';
      }
      return;
    }

    // Save cursor position before updating
    const selection = window.getSelection();
    let savedOffset = 0;
    if (selection.rangeCount > 0 && contentEditableRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const preCaretRange = document.createRange();
      preCaretRange.selectNodeContents(contentEditableRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      savedOffset = preCaretRange.toString().length;
    }

    // Clear and rebuild with styled segments
    contentEditableRef.current.innerHTML = '';
    segments.forEach((segment, idx) => {
      const isActive = activeSegmentId === segment.id;
      const isFixed = fixedSegmentId === segment.id;
      const isComplex = segment.status === 'complex';

      const span = document.createElement('span');
      span.textContent = segment.text + (idx < segments.length - 1 ? '. ' : '');
      span.style.color = isComplex
        ? isFixed
          ? '#22c55e'
          : 'rgba(239, 68, 68, 0.8)'
        : isFixed
        ? '#22c55e'
        : '#ffffff';
      span.style.textDecoration = isComplex && !isFixed ? 'underline wavy' : 'none';
      span.style.textDecorationColor = isComplex && !isFixed ? '#ef4444' : 'transparent';
      span.style.textUnderlineOffset = '2px';
      span.style.opacity = isComplex && !isFixed ? '0.8' : '1';
      span.style.transition = isFixed ? 'all 0.5s ease-in-out' : 'none';
      span.style.position = 'relative';
      span.style.backgroundColor = isFixed ? 'rgba(34, 197, 94, 0.2)' : 'transparent';
      span.style.animation = isFixed ? 'flash-green 0.5s ease-in-out' : 'none';
      span.setAttribute('data-segment-id', segment.id);

      if (isActive && isComplex && !isFixed) {
        const tooltip = document.createElement('span');
        tooltip.textContent = '💡 Simplify (Tab)';
        tooltip.style.cssText = `
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(8px);
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          white-space: nowrap;
          margin-bottom: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          pointer-events: none;
          z-index: 1000;
          font-weight: 500;
        `;
        span.appendChild(tooltip);
      }

      contentEditableRef.current.appendChild(span);
    });

    // Restore cursor position
    if (savedOffset > 0) {
      const textNodes = Array.from(contentEditableRef.current.childNodes).filter(
        node => node.nodeType === Node.TEXT_NODE || node.tagName === 'SPAN'
      );
      let currentPos = 0;
      let targetNode = null;
      let targetOffset = 0;

      for (const node of textNodes) {
        const nodeLength = node.textContent?.length || 0;
        if (savedOffset >= currentPos && savedOffset <= currentPos + nodeLength) {
          targetNode = node;
          targetOffset = savedOffset - currentPos;
          break;
        }
        currentPos += nodeLength;
      }

      if (targetNode) {
        const range = document.createRange();
        const textNode = targetNode.nodeType === Node.TEXT_NODE
          ? targetNode
          : targetNode.firstChild || targetNode;
        if (textNode) {
          const maxOffset = Math.min(targetOffset, textNode.textContent?.length || 0);
          range.setStart(textNode, maxOffset);
          range.setEnd(textNode, maxOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, [segments, activeSegmentId, fixedSegmentId, text]);

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      padding: '48px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#030712',
      overflow: 'hidden',
    }}>
      {/* GlassCard Container */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              fontSize: '36px',
              fontWeight: '700',
              marginBottom: '8px',
              background: 'linear-gradient(to right, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}>
              Jargon Assassin
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '16px',
            }}>
              Write simply. Red = complex. Tab to fix.
            </p>
            
            {/* Persona Dropdown Selector */}
            <div style={{
              position: 'relative',
              display: 'inline-block',
            }}>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                style={{
                  padding: '8px 32px 8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <option value="5yo" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                  🧒 The 5-Year-Old (Simpler)
                </option>
                <option value="skeptic" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                  🤔 The Skeptic (Logic checks)
                </option>
                <option value="interviewer" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                  🎤 The Interviewer (Examples)
                </option>
              </select>
            </div>
          </div>

          {/* HUD: Simplicity Score */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '120px',
          }}>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '8px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Simplicity Score
            </div>
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
            }}>
              {/* Circular Progress Ring */}
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke={simplicityScore >= 70 ? '#34d399' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - simplicityScore / 100)}
                  style={{
                    transition: 'stroke-dashoffset 0.3s ease-in-out, stroke 0.3s ease-in-out',
                  }}
                />
              </svg>
              {/* Center text */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '20px',
                fontWeight: '700',
                color: simplicityScore >= 70 ? '#34d399' : '#ef4444',
                transition: 'color 0.3s ease-in-out',
              }}>
                {simplicityScore}
              </div>
            </div>
          </div>
        </div>

        {/* Editor Container with Margin Layout */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '24px',
          minHeight: 0,
          position: 'relative',
        }}>
          {/* Text Area (70% width) */}
          <div style={{
            width: '70%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative',
          }} ref={textAreaRef}>
            <div
              ref={contentEditableRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
            onKeyUp={() => {
              // Update cursor segment on key up
              setTimeout(() => {
                if (contentEditableRef.current && text.trim() && segments.length > 0) {
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const preCaretRange = document.createRange();
                    preCaretRange.selectNodeContents(contentEditableRef.current);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    const caretPosition = preCaretRange.toString().length;

                    let currentPos = 0;
                    for (const segment of segments) {
                      const segmentLength = segment.text.length + (segments.indexOf(segment) < segments.length - 1 ? 2 : 0);
                      if (caretPosition >= currentPos && caretPosition <= currentPos + segmentLength) {
                        setActiveSegmentId(segment.id);
                        return;
                      }
                      currentPos += segmentLength;
                    }
                    setActiveSegmentId(null);
                  }
                }
              }, 10);
            }}
            onMouseUp={() => {
              // Update cursor segment on mouse click
              setTimeout(() => {
                if (contentEditableRef.current && text.trim() && segments.length > 0) {
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const preCaretRange = document.createRange();
                    preCaretRange.selectNodeContents(contentEditableRef.current);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    const caretPosition = preCaretRange.toString().length;

                    let currentPos = 0;
                    for (const segment of segments) {
                      const segmentLength = segment.text.length + (segments.indexOf(segment) < segments.length - 1 ? 2 : 0);
                      if (caretPosition >= currentPos && caretPosition <= currentPos + segmentLength) {
                        setActiveSegmentId(segment.id);
                        return;
                      }
                      currentPos += segmentLength;
                    }
                    setActiveSegmentId(null);
                  }
                }
              }, 10);
            }}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '400px',
                padding: '24px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                color: '#ffffff',
                fontSize: '18px',
                lineHeight: '1.8',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                outline: 'none',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
              data-placeholder="Start typing... Complex sentences will be highlighted in red. Press Tab to simplify them automatically."
            />


            {/* Stats Footer */}
            <div style={{
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.5)',
            }}>
              <div>
                {segments.length > 0 && (
                  <>
                    {segments.filter(s => s.status === 'simple').length} simple •{' '}
                    {segments.filter(s => s.status === 'complex').length} complex
                  </>
                )}
              </div>
              <div>
                {activeSegmentId && segments.find(s => s.id === activeSegmentId)?.status === 'complex' && (
                  <span style={{ color: '#fbbf24' }}>
                    💡 Tab to simplify
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Comments Column (30% width) */}
          <div
            ref={marginRef}
            style={{
              width: '30%',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '100%',
              overflowY: 'auto',
              position: 'relative',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              paddingLeft: '16px',
              gap: '16px',
            }}
          >
            {marginComments.length > 0 ? (
              marginComments.map((comment) => {
                const isResolved = comment.status === 'resolved' || resolvedCommentIds.has(comment.id);
                
                return (
                  <div
                    key={comment.id}
                    style={{
                      backgroundColor: isResolved
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(251, 191, 36, 0.1)',
                      backdropFilter: 'blur(12px)',
                      borderLeft: `4px solid ${isResolved ? '#22c55e' : '#fbbf24'}`,
                      padding: '12px',
                      borderRadius: '0 8px 8px 0',
                      fontSize: '13px',
                      color: isResolved ? '#d1fae5' : '#fef3c7',
                      opacity: isResolved ? 0 : 1,
                      animation: isResolved
                        ? 'resolve-fade-out 1s ease-in-out forwards'
                        : 'fade-in 0.3s ease-in forwards',
                      transition: isResolved ? 'all 1s ease-in-out' : 'none',
                      boxShadow: isResolved
                        ? '0 0 20px rgba(34, 197, 94, 0.3)'
                        : 'none',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: isResolved ? '#22c55e' : '#fbbf24',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {selectedPersona === '5yo' && '🧒 5-Year-Old'}
                      {selectedPersona === 'skeptic' && '🤔 Skeptic'}
                      {selectedPersona === 'interviewer' && '🎤 Interviewer'}
                    </div>
                    <div style={{
                      lineHeight: '1.6',
                      color: isResolved ? '#22c55e' : '#fef3c7',
                      fontWeight: isResolved ? '600' : '400',
                    }}>
                      {isResolved ? '✅ Resolved!' : comment.text}
                    </div>
                    {isResolved && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        fontSize: '18px',
                        animation: 'checkmark-pop 0.4s ease-out',
                      }}>
                        ✅
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'rgba(255, 255, 255, 0.3)',
                fontSize: '14px',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '24px',
              }}>
                {text.trim()
                  ? 'Keep writing... Feedback will appear here when you pause.'
                  : 'Start typing to see AI margin comments here.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes flash-green {
          0%, 100% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(34, 197, 94, 0.2);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes resolve-glow {
          0% {
            opacity: 1;
            border-left-color: #fbbf24;
            background-color: rgba(251, 191, 36, 0.1);
            box-shadow: 0 0 0 rgba(34, 197, 94, 0);
          }
          30% {
            border-left-color: #22c55e;
            background-color: rgba(34, 197, 94, 0.2);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
          }
          60% {
            border-left-color: #22c55e;
            background-color: rgba(34, 197, 94, 0.15);
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
          }
          100% {
            opacity: 0;
            transform: translateX(20px) scale(0.95);
            box-shadow: 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        
        @keyframes resolve-fade-out {
          0% {
            opacity: 1;
            border-left-color: #22c55e;
            background-color: rgba(34, 197, 94, 0.2);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
          }
          100% {
            opacity: 0;
            transform: translateX(20px) scale(0.95);
          }
        }
        
        @keyframes checkmark-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        [data-fixed="true"] {
          animation: flash-green 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default FeynmanInterface;

