// The exercise programme. Edit this file to change the sessions — nothing else
// needs to change; the Today and Plan screens both read from here.

export type PlanSession = {
  title: string
  detail: string
}

export type PlanDay = {
  day: string
  am: PlanSession
  pm: PlanSession
}

export const PLAN: PlanDay[] = [
  {
    day: 'Monday',
    am: {
      title: 'Mobility & pelvic floor',
      detail:
        '5 min easy walk or march; full-body mobility flow (neck, shoulders, hips, ankles); pelvic floor 3 x 10 slow holds, 3 x 10 quick',
    },
    pm: {
      title: 'Lower body strength',
      detail:
        'Sit-to-stand squats 3 x 12; split squats 3 x 8 each leg; glute bridges 3 x 12; calf raises 2 x 15; 2 min stretch',
    },
  },
  {
    day: 'Tuesday',
    am: {
      title: 'Brisk walk',
      detail: '20 min out and back, quick enough that talking is an effort. Same route each week',
    },
    pm: {
      title: 'Upper body',
      detail:
        'Press-ups (floor or worktop) 3 x 8-12; one-arm row 3 x 10 each; shoulder press 3 x 10; band or towel pull-apart 2 x 15',
    },
  },
  {
    day: 'Wednesday',
    am: {
      title: 'Mobility & core',
      detail:
        'Mobility flow; dead bug 3 x 8 each side; bird dog 3 x 8 each side; side plank 3 x 20 sec each; pelvic floor set',
    },
    pm: {
      title: 'Easy movement',
      detail: '20 min easy walk, bike or gentle stretch. Deliberately light',
    },
  },
  {
    day: 'Thursday',
    am: {
      title: 'Walk intervals',
      detail: '3 min easy, then 6 x (1 min hard / 1 min easy), 3 min easy',
    },
    pm: {
      title: 'Full body circuit',
      detail: '4 rounds, 40 sec on / 20 sec off: squat, press-up, row, glute bridge, march or step-up',
    },
  },
  {
    day: 'Friday',
    am: {
      title: 'Mobility & pelvic floor',
      detail: 'As Monday, plus 5 min on whatever felt tightest this week',
    },
    pm: {
      title: 'Lower body & carries',
      detail: "Goblet or bag squat 3 x 10; hip hinge 3 x 10; farmer's carry 4 x 30 sec; step-ups 3 x 10 each",
    },
  },
  {
    day: 'Saturday',
    am: {
      title: 'Long-ish walk',
      detail: '20 min minimum, outside, whatever the weather',
    },
    pm: {
      title: 'Core & stretch',
      detail: 'Plank 3 x 30 sec; dead bug 3 x 10; side plank 3 x 25 sec each; 8 min full stretch',
    },
  },
  {
    day: 'Sunday',
    am: {
      title: 'Gentle mobility',
      detail: '20 min easy movement and stretching',
    },
    pm: {
      title: 'Rest & plan',
      detail: 'Review the week on the Progress tab',
    },
  },
]

export const PHASES = [
  {
    name: 'Weeks 1-4 — Foundation',
    text: 'Turn up, every session, at the easier end. Groove the movements and the habit. If in doubt, do less than you could.',
  },
  {
    name: 'Weeks 5-8 — Build',
    text: 'Same sessions, more of them completed. Add a rep or two, or a little load, once a session feels comfortably repeatable.',
  },
  {
    name: 'Weeks 9-12 — Push',
    text: 'Hold the shape of the week and lift the effort: harder intervals, heavier carries, longer holds. Keep the easy days genuinely easy.',
  },
]

export const GROUND_RULES = [
  'Never hold your breath under load. Breathe out on the effort.',
  'Stop anything that causes pain rather than effort.',
  'Get the go-ahead from a GP or physio before adding real load or hard intervals.',
]
