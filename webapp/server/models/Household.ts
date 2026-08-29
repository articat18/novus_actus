import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const householdSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      unique: true,
      index: true,
    },
    rooms: [
      {
        type: Schema.Types.ObjectId,
        ref: "Room",
        required: true,
      },
    ],
  },
  { timestamps: true },
);

export type HouseholdDocument = InferSchemaType<typeof householdSchema>;

export const Household =
  (mongoose.models.Household as Model<HouseholdDocument>) ||
  mongoose.model<HouseholdDocument>("Household", householdSchema);
