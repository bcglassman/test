import type { ExerciseCategory, TrackingMethod, Unit } from "./lib/taxonomy";

export interface SeedExercise {
  name: string;
  category: ExerciseCategory;
  focus: string[];
  description: string;
  trackingMethods: TrackingMethod[];
  primaryUnit?: Unit;
  equipment: string[];
  techniqueNotes: string;
  /** Rating Library keys, in presentation order. */
  ratingKeys: string[];
}

/**
 * The seeded Exercise Library, covering everyday activity through to sprint
 * work. Definitions only — nothing here is dog-specific.
 */
export const SEED_EXERCISES: SeedExercise[] = [
  // ---------------------------------------------------------------- Walking
  {
    name: "Long Walk",
    category: "Walking & General Activity",
    focus: ["General", "Cardio"],
    description:
      "A sustained outdoor walk performed primarily for general activity, aerobic conditioning, environmental enrichment and maintaining everyday movement capacity. The walk may include normal changes in pace, stops and terrain rather than requiring highly structured movement throughout.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Allow a comfortable sustainable pace. Watch for meaningful changes in gait, slowing, excessive fatigue or reduced willingness as duration increases.",
    ratingKeys: ["intensity", "endurance", "gait_form"],
  },
  {
    name: "Easy Walk",
    category: "Walking & General Activity",
    focus: ["General", "Recovery"],
    description:
      "A relaxed, low-effort walk performed at an easy pace. It may be used for general movement, warm-up, cool-down or recovery between more demanding training sessions.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Maintain an easy pace and allow natural movement without deliberately increasing workload.",
    ratingKeys: ["gait_form", "recovery", "intensity"],
  },
  {
    name: "Brisk Walk",
    category: "Walking & General Activity",
    focus: ["Cardio", "Conditioning"],
    description:
      "A purposeful walk performed faster than a casual walking pace while remaining in a walking gait. It is used to increase cardiovascular workload without progressing to running or sprinting.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Maintain a consistent purposeful pace while preserving clean walking mechanics.",
    ratingKeys: ["intensity", "endurance", "pace_consistency", "gait_form"],
  },
  {
    name: "Structured Slow Walk",
    category: "Walking & General Activity",
    focus: ["Gait", "Movement Control", "Body Awareness"],
    description:
      "A deliberately slow walking exercise intended to increase conscious limb placement, movement control and gait quality. Slowing the dog reduces reliance on momentum and makes individual stepping patterns easier to observe.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Encourage slow, deliberate walking without repeated stopping, rushing or excessive lure dependence.",
    ratingKeys: ["gait_form", "movement_control", "symmetry"],
  },
  {
    name: "Incline / Hill Walk",
    category: "Walking & General Activity",
    focus: ["Hind Limb", "Conditioning", "Cardio"],
    description:
      "Controlled walking on an uphill gradient to increase cardiovascular demand and encourage greater hind-limb contribution compared with flat walking.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Use a manageable gradient that allows the dog to maintain a controlled walking gait without bounding, pulling or losing form.",
    ratingKeys: ["intensity", "hind_limb_engagement", "gait_form", "endurance"],
  },
  {
    name: "Uneven-Terrain Walk",
    category: "Walking & General Activity",
    focus: ["Stability", "Proprioception", "Body Awareness"],
    description:
      "Walking over naturally variable but safe surfaces such as grass, gentle trails or uneven ground. The changing surface encourages continual adjustments in foot placement, balance and body position.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Select safe terrain appropriate for the dog. Maintain a controlled pace and avoid surfaces that create unnecessary slipping or jumping.",
    ratingKeys: ["gait_form", "balance_stability", "body_awareness", "movement_control"],
  },

  // ----------------------------------------------------------- Conditioning
  {
    name: "Flat Treadmill Walk",
    category: "Conditioning",
    focus: ["Cardio", "Gait", "Conditioning"],
    description:
      "Controlled walking on a powered treadmill at a consistent flat setting. The exercise provides a repeatable environment for cardiovascular conditioning and gait observation.",
    trackingMethods: ["Duration", "Intervals", "Active Duration"],
    primaryUnit: "Minutes",
    equipment: ["Treadmill"],
    techniqueNotes:
      "Use a comfortable walking speed. Keep the dog centered and avoid unnecessary leash or handler interference with gait.",
    ratingKeys: ["intensity", "endurance", "gait_form", "pace_consistency"],
  },
  {
    name: "Incline Treadmill Walk",
    category: "Conditioning",
    focus: ["Cardio", "Hind Limb", "Muscular Endurance"],
    description:
      "Controlled treadmill walking performed at an incline to increase workload and encourage greater posterior-chain contribution.",
    trackingMethods: ["Duration", "Intervals", "Active Duration"],
    primaryUnit: "Minutes",
    equipment: ["Treadmill"],
    techniqueNotes:
      "Use an incline and speed that allow a clean alternating walking gait. Reduce workload if stride becomes rushed, shortened or mechanically inconsistent.",
    ratingKeys: ["intensity", "endurance", "gait_form", "hind_limb_engagement", "pace_consistency"],
  },
  {
    name: "Incline Treadmill Intervals",
    category: "Conditioning",
    focus: ["Cardio", "Hind Limb", "Muscular Endurance"],
    description:
      "Repeated periods of incline treadmill walking separated by planned recovery periods. The exercise is used to build cardiovascular capacity, muscular endurance and the ability to preserve movement quality under repeated workload.",
    trackingMethods: ["Sets", "Intervals", "Active Duration"],
    primaryUnit: "Seconds",
    equipment: ["Treadmill"],
    techniqueNotes:
      "Keep work and rest periods structured. Maintain clean movement throughout each interval rather than increasing speed or incline at the expense of form.",
    ratingKeys: ["intensity", "endurance", "gait_form", "hind_limb_engagement", "pace_consistency", "form_under_fatigue"],
  },
  {
    name: "Carpetmill Walk",
    category: "Conditioning",
    focus: ["Strength", "Conditioning", "Muscular Endurance", "Hind Limb"],
    description:
      "Controlled walking on a self-powered high-resistance carpetmill. The dog must actively move the belt, increasing muscular demand compared with normal walking.",
    trackingMethods: ["Duration", "Active Duration"],
    primaryUnit: "Seconds",
    equipment: ["Carpetmill"],
    techniqueNotes:
      "Keep the dog centered and maintain minimal tether interference. Look for a clean alternating gait rather than bounding or paired hind-limb action. Avoid continuously pulling the dog forward with a reward.",
    ratingKeys: ["intensity", "gait_form", "hind_limb_engagement", "pace_consistency"],
  },
  {
    name: "Carpetmill Intervals",
    category: "Conditioning",
    focus: ["Conditioning", "Muscular Endurance", "Hind Limb", "Strength"],
    description:
      "Short periods of high-resistance carpetmill walking separated by recovery periods. The exercise develops muscular endurance and conditioning while allowing movement quality to be assessed as workload accumulates.",
    trackingMethods: ["Sets", "Intervals", "Active Duration"],
    primaryUnit: "Seconds",
    equipment: ["Carpetmill"],
    techniqueNotes:
      "Prioritize technically clean work over duration. Keep the dog centered with minimal tether influence. Reward clean intervals rather than continuously luring. Stop or reset if gait becomes bounding, fragmented or excessively reward-driven.",
    ratingKeys: ["intensity", "endurance", "gait_form", "hind_limb_engagement", "pace_consistency", "form_under_fatigue"],
  },
  {
    name: "Slatmill Walk / Trot",
    category: "Conditioning",
    focus: ["Cardio", "Conditioning", "Gait"],
    description:
      "Self-powered walking or trotting on a low-resistance slatmill. The dog determines belt speed through its own movement, allowing conditioning work at a naturally selected pace.",
    trackingMethods: ["Duration", "Active Duration", "Intervals"],
    primaryUnit: "Minutes",
    equipment: ["Slatmill"],
    techniqueNotes:
      "Encourage controlled movement and avoid excessive acceleration or reward-driven surging. Monitor gait as speed increases.",
    ratingKeys: ["intensity", "endurance", "gait_form", "pace_consistency", "form_under_fatigue"],
  },
  {
    name: "Free Swimming",
    category: "Conditioning",
    focus: ["Cardio", "Low Impact", "Conditioning"],
    description:
      "Continuous free swimming used for cardiovascular exercise with reduced weight-bearing load on the limbs. Swimming requires sustained whole-body movement while minimizing ground impact.",
    trackingMethods: ["Duration", "Active Duration"],
    primaryUnit: "Minutes",
    equipment: ["Pool"],
    techniqueNotes:
      "Ensure safe entry and exit. Monitor swimming rhythm, body position, fatigue and whether one side consistently contributes differently.",
    ratingKeys: ["intensity", "endurance", "movement_fluidity", "recovery"],
  },
  {
    name: "Swim Intervals",
    category: "Conditioning",
    focus: ["Conditioning", "Cardio", "Muscular Endurance"],
    description:
      "Repeated periods of active swimming separated by planned rest. This allows higher-quality swimming work without requiring prolonged continuous effort.",
    trackingMethods: ["Sets", "Intervals", "Active Duration"],
    primaryUnit: "Seconds",
    equipment: ["Pool"],
    techniqueNotes:
      "Use defined work and rest periods. Stop an interval if stroke quality or body position deteriorates significantly.",
    ratingKeys: ["intensity", "endurance", "pace_consistency", "movement_fluidity", "form_under_fatigue", "recovery"],
  },
  {
    name: "Underwater Treadmill",
    category: "Conditioning",
    focus: ["Gait", "Conditioning", "Hind Limb", "Low Impact"],
    description:
      "Walking on a treadmill while partially supported by water. Water reduces effective weight-bearing while providing resistance to limb movement, making the exercise useful for controlled gait and conditioning work.",
    trackingMethods: ["Duration", "Intervals", "Active Duration"],
    primaryUnit: "Minutes",
    equipment: ["Underwater Treadmill"],
    techniqueNotes:
      "Record water height, speed and incline as session notes where relevant. Maintain controlled gait and monitor left/right limb use.",
    ratingKeys: ["gait_form", "hind_limb_engagement", "symmetry", "endurance", "movement_control"],
  },

  // --------------------------------------------------------------- Strength
  {
    name: "Sit-to-Stand",
    category: "Strength",
    focus: ["Hind Limb", "Strength", "Core"],
    description:
      "Repeated controlled transitions from sitting to standing. The exercise develops hind-limb strength, weight transfer and postural control.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["None"],
    techniqueNotes:
      "Begin from a square sit where practical. Encourage a controlled rise without excessive forelimb pulling, sideways shifting or momentum.",
    ratingKeys: ["hind_limb_engagement", "movement_control", "symmetry", "body_stability"],
  },
  {
    name: "Stand-to-Sit",
    category: "Strength",
    focus: ["Hind Limb", "Strength", "Movement Control"],
    description:
      "Controlled lowering from standing into a sit. The exercise emphasizes eccentric hind-limb control and controlled weight transfer.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["None"],
    techniqueNotes:
      "Encourage a slow, centered descent rather than collapsing, stepping sideways or dropping abruptly.",
    ratingKeys: ["movement_control", "symmetry", "hind_limb_engagement", "body_stability"],
  },
  {
    name: "Hind-Leg Step-Up",
    category: "Strength",
    focus: ["Hind Limb", "Strength", "Proprioception"],
    description:
      "The dog keeps the front feet supported while stepping one or both hind feet onto a low platform. The exercise develops rear-limb engagement, conscious hind-foot placement and controlled weight transfer.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Platform", "Step"],
    techniqueNotes:
      "Use a low stable platform. Reward deliberate rear-foot placement and a square stable position. Monitor whether the same hind limb consistently initiates every repetition.",
    ratingKeys: ["hind_limb_engagement", "movement_control", "symmetry", "body_stability", "intensity"],
  },
  {
    name: "Step-Up / Step-Down",
    category: "Strength",
    focus: ["Hind Limb", "Strength", "Stability"],
    description:
      "Controlled stepping onto and off a raised platform. The exercise develops limb strength, stability and eccentric control during the descent.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Step", "Platform"],
    techniqueNotes:
      "Use a stable appropriately sized platform. Emphasize controlled ascent and descent rather than jumping.",
    ratingKeys: ["movement_control", "hind_limb_engagement", "balance_stability", "symmetry"],
  },
  {
    name: "Front Feet Elevated Stand",
    category: "Strength",
    focus: ["Hind Limb", "Core", "Stability"],
    description:
      "A static standing position with the front feet placed on a low raised platform while the hind feet remain on the ground. The setup shifts relative loading and can increase engagement of the hindquarters and trunk.",
    trackingMethods: ["Sets", "Hold Time"],
    primaryUnit: "Seconds",
    equipment: ["Platform"],
    techniqueNotes:
      "Keep the dog square and stable. Avoid excessive reaching forward or collapsing through the trunk.",
    ratingKeys: ["hind_limb_engagement", "body_stability", "postural_control", "symmetry"],
  },
  {
    name: "Rear Feet Elevated Stand",
    category: "Strength",
    focus: ["Forelimb", "Core", "Stability"],
    description:
      "A static standing position with the rear feet elevated while the front feet remain on the ground. The exercise increases relative loading and stabilization demands through the forequarters and trunk.",
    trackingMethods: ["Sets", "Hold Time"],
    primaryUnit: "Seconds",
    equipment: ["Platform"],
    techniqueNotes:
      "Keep the body aligned and ensure the dog is comfortable maintaining the elevated position without slipping or rotating.",
    ratingKeys: ["forelimb_control", "body_stability", "postural_control", "symmetry"],
  },
  {
    name: "Controlled Backward Walk",
    category: "Strength",
    focus: ["Hind Limb", "Proprioception", "Movement Control"],
    description:
      "Slow intentional backward walking that requires the dog to deliberately place the hind limbs without seeing the direction of travel.",
    trackingMethods: ["Sets", "Steps", "Distance"],
    primaryUnit: "Steps",
    equipment: ["None"],
    techniqueNotes:
      "Encourage individual controlled backward steps. Avoid forcing the dog backward physically or allowing rapid uncontrolled shuffling.",
    ratingKeys: ["hind_limb_engagement", "movement_control", "coordination", "rear_end_awareness"],
  },
  {
    name: "Weight Shifts",
    category: "Strength",
    focus: ["Stability", "Body Awareness"],
    description:
      "Controlled movement of body weight from one limb or side to another while maintaining a generally stable base position.",
    trackingMethods: ["Sets", "Reps", "Hold Time"],
    primaryUnit: "Reps",
    equipment: ["None"],
    techniqueNotes:
      "Use subtle controlled shifts. Avoid pushing the dog so far that paws must repeatedly reposition.",
    ratingKeys: ["weight_shift", "body_stability", "symmetry", "movement_control"],
  },
  {
    name: "Three-Leg Stand / Paw Lift",
    category: "Strength",
    focus: ["Balance", "Stability", "Core", "Proprioception"],
    description:
      "A controlled static exercise in which one paw is lifted while the dog maintains balance on the remaining three limbs.",
    trackingMethods: ["Sets", "Reps", "Hold Time"],
    primaryUnit: "Seconds",
    equipment: ["None"],
    techniqueNotes:
      "Use short stable holds. Keep the body as centered as possible and avoid forcing a position the dog cannot comfortably maintain.",
    ratingKeys: ["balance_stability", "weight_bearing_control", "body_awareness", "postural_control"],
  },

  // ----------------------------------------- Coordination & Proprioception
  {
    name: "Cavaletti — Slow Walk",
    category: "Coordination & Proprioception",
    focus: ["Coordination", "Hind Limb", "Body Awareness", "Gait"],
    description:
      "Slow controlled walking over a sequence of low poles. The exercise encourages deliberate paw placement, limb coordination, obstacle awareness and controlled gait.",
    trackingMethods: ["Sets", "Passes", "Active Duration"],
    primaryUnit: "Passes",
    equipment: ["Cavaletti Poles"],
    techniqueNotes:
      "Maintain a deliberate walking pace. Encourage forward focus and independent obstacle negotiation. Avoid rushing or excessive handler/lure dependence.",
    ratingKeys: ["gait_form", "intensity", "directional_control"],
  },
  {
    name: "Raised Cavaletti",
    category: "Coordination & Proprioception",
    focus: ["Coordination", "Paw Awareness", "Hind Limb"],
    description:
      "Cavaletti performed with poles raised above floor level to increase limb clearance demands and encourage greater conscious paw placement.",
    trackingMethods: ["Sets", "Passes", "Active Duration"],
    primaryUnit: "Passes",
    equipment: ["Cavaletti Poles"],
    techniqueNotes:
      "Use an appropriate pole height and spacing. Maintain a controlled walking gait and reduce difficulty if repeated pole contacts occur.",
    ratingKeys: ["gait_form", "paw_placement", "obstacle_clearance", "hind_limb_engagement"],
  },
  {
    name: "Variable-Height Cavaletti",
    category: "Coordination & Proprioception",
    focus: ["Coordination", "Proprioception", "Paw Awareness"],
    description:
      "A cavaletti sequence using intentionally varied pole heights to require continual adjustment of limb trajectory and body position.",
    trackingMethods: ["Sets", "Passes"],
    primaryUnit: "Passes",
    equipment: ["Cavaletti Poles"],
    techniqueNotes:
      "Keep the variation moderate and predictable enough that the dog can remain controlled. Prioritize accurate stepping over speed.",
    ratingKeys: ["coordination", "paw_placement", "gait_form", "obstacle_clearance"],
  },
  {
    name: "Figure-8 Walk",
    category: "Coordination & Proprioception",
    focus: ["Directional Control", "Mobility", "Coordination"],
    description:
      "Walking in a figure-eight pattern around two markers. The repeated direction changes encourage controlled bending, weight shifting and coordinated turning in both directions.",
    trackingMethods: ["Sets", "Reps", "Duration"],
    primaryUnit: "Reps",
    equipment: ["Cones"],
    techniqueNotes:
      "Use smooth wide turns initially. Aim for similar movement quality and control in both directions.",
    ratingKeys: ["directional_control", "movement_control", "symmetry", "movement_fluidity"],
  },
  {
    name: "Cone Weave",
    category: "Coordination & Proprioception",
    focus: ["Coordination", "Directional Control", "Body Awareness"],
    description:
      "The dog weaves through a series of cones or markers, requiring repeated changes in direction and body position.",
    trackingMethods: ["Sets", "Passes"],
    primaryUnit: "Passes",
    equipment: ["Cones"],
    techniqueNotes:
      "Space cones widely enough to allow controlled movement. Reduce excessive lure dependence as the dog learns the route.",
    ratingKeys: ["directional_control", "movement_fluidity", "coordination", "movement_control"],
  },
  {
    name: "Paw Targeting",
    category: "Coordination & Proprioception",
    focus: ["Paw Awareness", "Body Awareness", "Coordination"],
    description:
      "The dog intentionally places one or more paws onto a defined target. The exercise develops awareness and deliberate control of individual limb placement.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes:
      "Reward intentional accurate paw placement. Progress toward smaller targets only after control is reliable.",
    ratingKeys: ["paw_placement", "body_awareness", "movement_control", "consistency"],
  },
  {
    name: "Rear-Paw Targeting",
    category: "Coordination & Proprioception",
    focus: ["Hind Limb", "Paw Awareness"],
    description:
      "The dog intentionally locates and places one or both rear paws onto a target, developing conscious control of the hindquarters.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Target", "Platform"],
    techniqueNotes:
      "Encourage deliberate rear-foot placement without physically positioning the dog's limbs.",
    ratingKeys: ["rear_end_awareness", "paw_placement", "movement_control", "hind_limb_engagement"],
  },
  {
    name: "Balance Pad Stand",
    category: "Coordination & Proprioception",
    focus: ["Balance", "Stability", "Proprioception", "Core"],
    description:
      "A static standing exercise performed with one or more paws supported on a slightly unstable surface, increasing postural and stabilizing demands.",
    trackingMethods: ["Sets", "Hold Time"],
    primaryUnit: "Seconds",
    equipment: ["Balance Pad"],
    techniqueNotes:
      "Use a stable enough surface that the dog can maintain control. Avoid excessive instability for the sake of difficulty.",
    ratingKeys: ["balance_stability", "body_awareness", "postural_control", "body_stability"],
  },

  // --------------------------------------------------------------- Mobility
  {
    name: "Nose-to-Tail",
    category: "Mobility",
    focus: ["Neck", "Spine", "Mobility"],
    description:
      "A controlled active lateral-flexion exercise in which the dog turns the nose toward the side of the torso or tail while maintaining a stable starting position.",
    trackingMethods: ["Sets", "Reps per Side"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes:
      "Maintain a consistent starting posture. Use a small controlled lure path and return fully to neutral between repetitions. Do not create additional apparent range through stepping or changing position.",
    ratingKeys: ["range_of_motion", "movement_control", "movement_fluidity", "body_stability"],
  },
  {
    name: "Nose-to-Hip / Flank",
    category: "Mobility",
    focus: ["Neck", "Spine", "Mobility"],
    description:
      "A controlled lateral bend in which the dog brings the nose toward the hip or flank. It provides a simpler active-range target than reaching fully toward the tail.",
    trackingMethods: ["Sets", "Reps per Side"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes:
      "Keep the base position stable and compare movement quality between left and right sides.",
    ratingKeys: ["range_of_motion", "movement_control", "symmetry", "movement_fluidity"],
  },
  {
    name: "Nose-to-Chest",
    category: "Mobility",
    focus: ["Neck", "Mobility"],
    description:
      "A controlled cervical-flexion exercise in which the dog lowers and curls the head toward the chest while maintaining a stable body position.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes:
      "Use a small controlled range. Avoid encouraging the dog to move the entire body forward or collapse through the forequarters.",
    ratingKeys: ["range_of_motion", "movement_control", "movement_fluidity"],
  },
  {
    name: "Nose-Up / Neck Extension",
    category: "Mobility",
    focus: ["Neck", "Mobility"],
    description:
      "A controlled active extension exercise in which the dog raises the nose upward while maintaining a stable trunk and limb position.",
    trackingMethods: ["Sets", "Reps"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes: "Use gentle controlled extension and avoid forcing maximal range.",
    ratingKeys: ["range_of_motion", "movement_control", "movement_fluidity"],
  },
  {
    name: "Play Bow Stretch",
    category: "Mobility",
    focus: ["Spine", "Forelimb", "Mobility"],
    description:
      "A controlled play-bow position in which the forequarters lower while the hindquarters remain elevated. The movement encourages mobility through the shoulders, spine and surrounding tissues.",
    trackingMethods: ["Sets", "Reps", "Hold Time"],
    primaryUnit: "Reps",
    equipment: ["None"],
    techniqueNotes:
      "Encourage a comfortable controlled position. Do not force the dog deeper into the stretch.",
    ratingKeys: ["range_of_motion", "movement_control", "body_stability", "movement_fluidity"],
  },
  {
    name: "Controlled Lateral Bend",
    category: "Mobility",
    focus: ["Spine", "Mobility", "Movement Control"],
    description:
      "A controlled active side-bending exercise that emphasizes smooth lateral movement through the trunk while keeping the dog's base position relatively stable.",
    trackingMethods: ["Sets", "Reps per Side"],
    primaryUnit: "Reps",
    equipment: ["Target"],
    techniqueNotes:
      "Prioritize smooth controlled motion and comparable left/right performance over maximum range.",
    ratingKeys: ["range_of_motion", "symmetry", "movement_fluidity", "movement_control"],
  },

  // ---------------------------------------------------------- Speed & Power
  {
    name: "Controlled Sprint",
    category: "Speed & Power",
    focus: ["Power", "Cardio", "Gait"],
    description:
      "A short maximal or near-maximal running effort performed over a defined distance with planned recovery between repetitions.",
    trackingMethods: ["Sets", "Reps", "Distance"],
    primaryUnit: "Meters",
    equipment: ["None"],
    techniqueNotes:
      "Use an appropriate warm-up and safe running surface. Provide adequate recovery between efforts and stop if gait deteriorates.",
    ratingKeys: ["intensity", "power", "gait_form", "recovery"],
  },
  {
    name: "Controlled Fetch Sprints",
    category: "Speed & Power",
    focus: ["Power", "Conditioning", "Cardio"],
    description:
      "Short sprint efforts performed as part of controlled fetch repetitions. Unlike unrestricted repetitive fetch, the number of efforts and recovery periods are intentionally managed.",
    trackingMethods: ["Sets", "Reps", "Distance"],
    primaryUnit: "Meters",
    equipment: ["Toy"],
    techniqueNotes:
      "Control the number of sprint repetitions and provide adequate recovery. Avoid repeated uncontrolled sharp turns or excessive high-arousal chasing.",
    ratingKeys: ["intensity", "power", "gait_form", "recovery", "arousal_control"],
  },
  {
    name: "Hill Sprint",
    category: "Speed & Power",
    focus: ["Hind Limb", "Power", "Conditioning"],
    description:
      "A short uphill running effort that increases resistance and posterior-chain demand compared with level sprinting.",
    trackingMethods: ["Sets", "Reps", "Distance"],
    primaryUnit: "Meters",
    equipment: ["None"],
    techniqueNotes:
      "Use a moderate safe gradient and adequate recovery. Maintain quality movement rather than maximizing repetition count.",
    ratingKeys: ["intensity", "power", "hind_limb_engagement", "gait_form", "recovery"],
  },
  {
    name: "Acceleration Run",
    category: "Speed & Power",
    focus: ["Power", "Gait", "Coordination"],
    description:
      "A short running exercise focused on the transition from a controlled start into faster movement rather than maintaining maximum speed over a long distance.",
    trackingMethods: ["Sets", "Reps", "Distance"],
    primaryUnit: "Meters",
    equipment: ["None"],
    techniqueNotes:
      "Use a safe surface with enough space for gradual acceleration and controlled deceleration.",
    ratingKeys: ["power", "gait_form", "coordination", "movement_control"],
  },

  // --------------------------------------------------- Recovery / Low Impact
  {
    name: "Recovery Walk",
    category: "Recovery / Low Impact",
    focus: ["Recovery", "General", "Low Impact"],
    description:
      "A short easy walk intended to maintain light movement without introducing significant training stress.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "Keep effort deliberately low and allow a comfortable self-selected walking pace.",
    ratingKeys: ["gait_form", "recovery", "intensity"],
  },
  {
    name: "Easy Swim",
    category: "Recovery / Low Impact",
    focus: ["Recovery", "Mobility", "Low Impact"],
    description:
      "Relaxed low-intensity swimming used to provide whole-body movement with minimal weight-bearing load.",
    trackingMethods: ["Duration", "Active Duration"],
    primaryUnit: "Minutes",
    equipment: ["Pool"],
    techniqueNotes:
      "Keep sessions short and relaxed. Monitor swimming quality and fatigue rather than encouraging speed.",
    ratingKeys: ["movement_fluidity", "recovery", "intensity"],
  },
  {
    name: "Easy Mobility Session",
    category: "Recovery / Low Impact",
    focus: ["Mobility", "Recovery"],
    description:
      "A short collection of gentle active-mobility exercises performed primarily to encourage comfortable movement rather than to create significant workload.",
    trackingMethods: ["Duration"],
    primaryUnit: "Minutes",
    equipment: ["Target"],
    techniqueNotes:
      "Use comfortable ranges and smooth movement. Avoid pushing for maximum range.",
    ratingKeys: ["range_of_motion", "movement_fluidity", "movement_control"],
  },
  {
    name: "Sniff Walk / Free Movement",
    category: "Recovery / Low Impact",
    focus: ["General", "Recovery", "Low Impact"],
    description:
      "An unstructured low-intensity walk that allows the dog to explore, sniff and move at a largely self-selected pace.",
    trackingMethods: ["Duration", "Distance"],
    primaryUnit: "Minutes",
    equipment: ["None"],
    techniqueNotes:
      "The goal is relaxed movement and environmental engagement rather than pace, distance or technical performance.",
    ratingKeys: ["intensity", "recovery"],
  },
];
