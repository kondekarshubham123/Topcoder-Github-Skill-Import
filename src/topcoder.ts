import axios from "axios";

const TOPCODER_SKILLS_API = '';

export interface TopcoderSkill { 
    id: string;
    name: string;
    description?: string;
}

export async function fetchAllSkills(): Promise<TopcoderSkill[]> {
    const response = await axios.get<TopcoderSkill[]>(TOPCODER_SKILLS_API);
    return response.data;
}