/**
 * Pebble Pals: Master Bao's Interactive Story Lessons
 */

const TUTORIAL_LESSONS = [
  {
    id: 'lesson-1',
    title: 'Lesson 1: Breathing Room',
    subtitle: 'Every Pebble Pal needs space to breathe!',
    boardSize: 5,
    steps: [
      {
        stepId: 1,
        baoMood: 'happy',
        text: "Hi there, little gardener! I'm <strong>Master Bao</strong> the Red Panda! Every Pebble Pal you place claims 1 box of garden for your team. Tap the highlighted box in the center <strong>(2, 2)</strong> to place your first pal!",
        highlight: [2, 2],
        targetMove: [2, 2],
        setup: (engine) => {
          engine.initBoard();
        },
        onMoveDoneText: "Splendid! Look closely at those 4 glowing green hearts around your pal!"
      },
      {
        stepId: 2,
        baoMood: 'excited',
        text: "Those 4 glowing hearts are <strong>Breathing Spaces (Liberties)</strong>! A Pebble Pal breathes Up, Down, Left, and Right. As long as it has at least 1 empty space next to it, it is safe and happy!",
        actionButton: "Let's test the wall! 🧱"
      },
      {
        stepId: 3,
        baoMood: 'thinking',
        text: "Now let's see what happens near the garden fence. Tap the corner box at <strong>(0, 0)</strong>! How many breathing spaces will it get?",
        highlight: [0, 0],
        targetMove: [0, 0],
        onMoveDoneText: "Aha! Look at the hearts!"
      },
      {
        stepId: 4,
        baoMood: 'celebrating',
        text: "Notice that? Against the garden wall, it only has <strong>2 breathing spaces</strong> because the outside walls don't breathe! You've mastered Lesson 1!",
        isLessonEnd: true
      }
    ]
  },
  {
    id: 'lesson-2',
    title: 'Lesson 2: Holding Hands',
    subtitle: 'Friends connect and share their breaths!',
    boardSize: 5,
    steps: [
      {
        stepId: 1,
        baoMood: 'happy',
        text: "Pebble Pals love company! When friendly pals touch <strong>Up, Down, Left, or Right</strong>, they hold hands and become ONE big team (a Group)! Tap at <strong>(2, 3)</strong> to hold hands with your blue pal!",
        highlight: [2, 3],
        targetMove: [2, 3],
        setup: (engine) => {
          engine.initBoard();
          engine.stones[2][2] = { colorId: 'ocean-blue', playerId: 0 };
        },
        onMoveDoneText: "Look at them hold hands!"
      },
      {
        stepId: 2,
        baoMood: 'excited',
        text: "Look at that! Together, they now share <strong>6 breathing spaces</strong>! When pals hold hands, they protect each other and are much harder to capture!",
        actionButton: "Do diagonals connect? ❓"
      },
      {
        stepId: 3,
        baoMood: 'surprised',
        text: "<strong>Important Rule:</strong> Diagonal neighbors NEVER hold hands! Only orthogonal (Up, Down, Left, Right) pals connect. Remember: <em>'Cross is boss, diagonal is lost!'</em>",
        isLessonEnd: true
      }
    ]
  },
  {
    id: 'lesson-3',
    title: 'Lesson 3: Pop & Splash!',
    subtitle: 'Rescue territory by capturing enemy pebbles!',
    boardSize: 5,
    steps: [
      {
        stepId: 1,
        baoMood: 'surprised',
        text: "Oh my whiskers! Look at that Coral Red pebble in the middle! Your blue pals have surrounded 3 of its sides. It only has <strong>1 breathing space left</strong> at <strong>(2, 3)</strong>—look at it trembling and sweating in <strong>Atari</strong>!",
        highlight: [2, 3],
        targetMove: [2, 3],
        setup: (engine) => {
          engine.initBoard();
          engine.stones[2][2] = { colorId: 'coral-red', playerId: 1 };
          engine.stones[1][2] = { colorId: 'ocean-blue', playerId: 0 };
          engine.stones[3][2] = { colorId: 'ocean-blue', playerId: 0 };
          engine.stones[2][1] = { colorId: 'ocean-blue', playerId: 0 };
        },
        onMoveDoneText: "KA-POW! POP!"
      },
      {
        stepId: 2,
        baoMood: 'celebrating',
        text: "<strong>POP!</strong> You surrounded it on all sides and took its last breath! Capturing awards you <strong>+2 Points</strong>, AND look at that empty space: it immediately splashed into <strong>YOUR blue territory (+1 Point)</strong>! Fantastic!",
        isLessonEnd: true
      }
    ]
  },
  {
    id: 'lesson-4',
    title: 'Lesson 4: Building a Fence',
    subtitle: 'Enclose empty spaces for free bonus points!',
    boardSize: 5,
    steps: [
      {
        stepId: 1,
        baoMood: 'thinking',
        text: "Here is the ultimate secret of Territory Quest: You don't have to fill every box! If your pals build a wall around empty boxes, all those spaces become <strong>Enclosed Territory</strong> for FREE!",
        setup: (engine) => {
          engine.initBoard();
          // Fence around 4 corner boxes (0,0), (0,1), (1,0), (1,1)
          engine.stones[0][2] = { colorId: 'ocean-blue', playerId: 0 };
          engine.stones[1][2] = { colorId: 'ocean-blue', playerId: 0 };
          engine.stones[2][2] = { colorId: 'ocean-blue', playerId: 0 };
          engine.stones[2][1] = { colorId: 'ocean-blue', playerId: 0 };
        },
        highlight: [2, 0],
        targetMove: [2, 0],
        onMoveDoneText: "MAGIC! The entire corner is yours!"
      },
      {
        stepId: 2,
        baoMood: 'celebrating',
        text: "<strong>HOORAY!</strong> By placing that pebble at (2, 0), you sealed the fence! All 4 empty boxes inside lit up with flowers and flags—giving you <strong>+4 Free Points</strong>! You are officially Master Bao's Territory Scholar!",
        isLessonEnd: true
      }
    ]
  }
];

class TutorialManager {
  constructor(app) {
    this.app = app;
    this.currentLessonIdx = 0;
    this.currentStepIdx = 0;
    this.engine = null;
    this.waitingForMove = false;
  }

  getCurrentLesson() {
    return TUTORIAL_LESSONS[this.currentLessonIdx];
  }

  getCurrentStep() {
    const lesson = this.getCurrentLesson();
    return lesson.steps[this.currentStepIdx];
  }

  startLesson(lessonIdx = 0) {
    this.currentLessonIdx = lessonIdx;
    this.currentStepIdx = 0;

    const lesson = this.getCurrentLesson();
    // Setup dedicated tutorial engine
    this.engine = new window.GameEngine({
      boardSize: lesson.boardSize,
      mode: '2-player',
      players: [
        { id: 0, name: 'You (Blue)', isBot: false, colorId: 'ocean-blue' },
        { id: 1, name: 'Guest (Red)', isBot: false, colorId: 'coral-red' }
      ]
    });

    this.runStep();
  }

  runStep() {
    const step = this.getCurrentStep();
    if (!step) return;

    if (step.setup) {
      step.setup(this.engine);
    }

    this.waitingForMove = Boolean(step.targetMove);
    this.app.renderTutorialView(this);
  }

  handleCellClick(r, c) {
    const step = this.getCurrentStep();
    if (!step || !step.targetMove) return;

    const [tr, tc] = step.targetMove;
    if (r === tr && c === tc) {
      // Correct move!
      const player = this.engine.getCurrentPlayer();
      const moveRes = this.engine.playMove(r, c);

      if (moveRes.success) {
        if (window.soundFx) {
          if (moveRes.capturedStones && moveRes.capturedStones.length > 0) {
            window.soundFx.playCapture();
          } else {
            window.soundFx.playPop();
          }
        }

        // Trigger confetti or sparkle if capturing or enclosing
        this.waitingForMove = false;
        
        // Show Bao celebration for this step
        if (step.onMoveDoneText) {
          step.text = step.onMoveDoneText;
        }

        // If this was the last move in the step, advance step after brief delay
        setTimeout(() => {
          this.advanceStep();
        }, 1200);
      }
    } else {
      // Incorrect cell clicked in tutorial
      if (window.soundFx) window.soundFx.playBoing();
      this.app.showToast(`Tap the glowing highlighted box at (${tr}, ${tc})!`);
    }
  }

  advanceStep() {
    const lesson = this.getCurrentLesson();
    const currentStep = this.getCurrentStep();

    if (currentStep.isLessonEnd || this.currentStepIdx >= lesson.steps.length - 1) {
      // Lesson completed!
      if (window.trophyTracker) {
        window.trophyTracker.completeLesson(lesson.id);
      }
      if (window.soundFx) {
        window.soundFx.playBadge();
      }
      this.app.renderTutorialVictory(lesson);
    } else {
      this.currentStepIdx++;
      this.runStep();
    }
  }

  nextLesson() {
    if (this.currentLessonIdx < TUTORIAL_LESSONS.length - 1) {
      this.startLesson(this.currentLessonIdx + 1);
    } else {
      // All lessons completed!
      this.app.showScreen('arena');
    }
  }
}

window.TUTORIAL_LESSONS = TUTORIAL_LESSONS;
window.TutorialManager = TutorialManager;
