/**
 * Test suite for time conversion utilities
 * Tests MM:SS format conversion functions
 */

import { secondsToMMSS, mmssToSeconds } from './utils';

describe('Time Conversion Utilities', () => {
  describe('secondsToMMSS', () => {
    it('should convert 0 seconds to "0:00"', () => {
      expect(secondsToMMSS(0)).toBe('0:00');
    });

    it('should convert 30 seconds to "0:30"', () => {
      expect(secondsToMMSS(30)).toBe('0:30');
    });

    it('should convert 60 seconds to "1:00"', () => {
      expect(secondsToMMSS(60)).toBe('1:00');
    });

    it('should convert 90 seconds to "1:30"', () => {
      expect(secondsToMMSS(90)).toBe('1:30');
    });

    it('should convert 120 seconds to "2:00"', () => {
      expect(secondsToMMSS(120)).toBe('2:00');
    });

    it('should convert 3661 seconds to "61:01"', () => {
      expect(secondsToMMSS(3661)).toBe('61:01');
    });

    it('should convert 45 seconds to "0:45"', () => {
      expect(secondsToMMSS(45)).toBe('0:45');
    });

    it('should convert 125 seconds to "2:05"', () => {
      expect(secondsToMMSS(125)).toBe('2:05');
    });

    it('should handle negative numbers by returning "0:00"', () => {
      expect(secondsToMMSS(-10)).toBe('0:00');
      expect(secondsToMMSS(-1)).toBe('0:00');
    });

    it('should handle NaN by returning "0:00"', () => {
      expect(secondsToMMSS(NaN)).toBe('0:00');
    });

    it('should handle large values correctly', () => {
      expect(secondsToMMSS(3600)).toBe('60:00');
      expect(secondsToMMSS(3660)).toBe('61:00');
      expect(secondsToMMSS(9999)).toBe('166:39');
    });

    it('should pad seconds with leading zero', () => {
      expect(secondsToMMSS(61)).toBe('1:01');
      expect(secondsToMMSS(62)).toBe('1:02');
      expect(secondsToMMSS(9)).toBe('0:09');
    });

    it('should handle decimal seconds by flooring', () => {
      expect(secondsToMMSS(90.7)).toBe('1:30');
      expect(secondsToMMSS(125.9)).toBe('2:05');
    });
  });

  describe('mmssToSeconds', () => {
    it('should convert "0:00" to 0 seconds', () => {
      expect(mmssToSeconds('0:00')).toBe(0);
    });

    it('should convert "0:30" to 30 seconds', () => {
      expect(mmssToSeconds('0:30')).toBe(30);
    });

    it('should convert "1:00" to 60 seconds', () => {
      expect(mmssToSeconds('1:00')).toBe(60);
    });

    it('should convert "1:30" to 90 seconds', () => {
      expect(mmssToSeconds('1:30')).toBe(90);
    });

    it('should convert "2:00" to 120 seconds', () => {
      expect(mmssToSeconds('2:00')).toBe(120);
    });

    it('should convert "10:45" to 645 seconds', () => {
      expect(mmssToSeconds('10:45')).toBe(645);
    });

    it('should convert "61:01" to 3661 seconds', () => {
      expect(mmssToSeconds('61:01')).toBe(3661);
    });

    it('should convert "0:45" to 45 seconds', () => {
      expect(mmssToSeconds('0:45')).toBe(45);
    });

    it('should convert "2:05" to 125 seconds', () => {
      expect(mmssToSeconds('2:05')).toBe(125);
    });

    it('should handle empty string by returning 0', () => {
      expect(mmssToSeconds('')).toBe(0);
      expect(mmssToSeconds('   ')).toBe(0);
    });

    it('should handle string without colon as seconds', () => {
      expect(mmssToSeconds('30')).toBe(30);
      expect(mmssToSeconds('120')).toBe(120);
      expect(mmssToSeconds('0')).toBe(0);
    });

    it('should handle invalid format by returning 0', () => {
      expect(mmssToSeconds('invalid')).toBe(0);
      expect(mmssToSeconds('abc:def')).toBe(0);
    });

    it('should handle missing minutes part by treating as 0', () => {
      // Function treats empty string before colon as "0"
      expect(mmssToSeconds(':30')).toBe(30); // Becomes 0:30 = 30 seconds
    });

    it('should handle missing seconds part by treating as 0', () => {
      // Function treats empty string after colon as "0"
      expect(mmssToSeconds('1:')).toBe(60); // Becomes 1:0 = 60 seconds
    });

    it('should handle single digit minutes', () => {
      expect(mmssToSeconds('5:30')).toBe(330);
      expect(mmssToSeconds('9:15')).toBe(555);
    });

    it('should handle double digit minutes', () => {
      expect(mmssToSeconds('15:30')).toBe(930);
      expect(mmssToSeconds('60:00')).toBe(3600);
    });

    it('should handle seconds over 59 correctly', () => {
      // Note: This function doesn't validate that seconds are < 60
      // It just parses what's given
      expect(mmssToSeconds('1:60')).toBe(120);
      expect(mmssToSeconds('1:99')).toBe(159);
    });


    it('should handle null/undefined-like values', () => {
      // TypeScript should prevent this, but testing runtime behavior
      expect(mmssToSeconds('')).toBe(0);
    });
  });

  describe('Round-trip conversion', () => {
    it('should convert seconds to MM:SS and back correctly', () => {
      const testCases = [0, 30, 60, 90, 120, 125, 300, 645, 3600, 3661];
      
      testCases.forEach(seconds => {
        const mmss = secondsToMMSS(seconds);
        const convertedBack = mmssToSeconds(mmss);
        expect(convertedBack).toBe(seconds);
      });
    });

    it('should convert MM:SS to seconds and back correctly', () => {
      const testCases = ['0:00', '0:30', '1:00', '1:30', '2:00', '10:45', '61:01'];
      
      testCases.forEach(mmss => {
        const seconds = mmssToSeconds(mmss);
        const convertedBack = secondsToMMSS(seconds);
        expect(convertedBack).toBe(mmss);
      });
    });
  });
});

